import os
import django
import asyncio
import socks
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError, FloodWaitError
from telethon.tl.functions.channels import (
    JoinChannelRequest,
    GetFullChannelRequest,
)
from telethon.tl.types import Channel, Chat, User
from asgiref.sync import sync_to_async
import sys

# --- Django setup ---
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "telemanager_django.settings")
django.setup()

from accounts.models import TelegramAccount  # noqa: E402
from users.models import TrainingChannel, TelegramUser  # noqa: E402

SESSIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "sessions")


async def _ensure_join(client: TelegramClient, entity) -> None:
    """
    Пытается присоединиться к чату/каналу; молча игнорирует, если уже внутри/приватный.
    """
    try:
        await client(JoinChannelRequest(entity))
    except Exception:
        pass  # уже внутри / приватный / нет прав — для сбора участников не критично


async def train_account(account: TelegramAccount):
    session_path = os.path.join(SESSIONS_DIR, f"{account.session_file}")
    if not os.path.exists(session_path):
        print(f"[{account.phone}] ❌ session file not found")
        return

    if not account.api_id or not account.api_hash:
        print(f"[{account.phone}] ❌ нет api_id/api_hash")
        return

    proxy = None
    if account.proxy:
        proxy_type = socks.SOCKS5 if account.proxy.proxy_type == "socks5" else socks.HTTP
        proxy = (
            proxy_type,
            account.proxy.host,
            account.proxy.port,
            True if account.proxy.username else False,
            account.proxy.username,
            account.proxy.password,
        )

    client = TelegramClient(session_path, int(account.api_id), account.api_hash, proxy=proxy)
    await client.connect()

    if not await client.is_user_authorized():
        try:
            await client.sign_in(password=account.twofa_password)
        except SessionPasswordNeededError:
            print(f"[{account.phone}] ❌ требуется 2FA, но не указано")
            await client.disconnect()
            return
        except Exception as e:
            print(f"[{account.phone}] ❌ ошибка входа: {e}")
            await client.disconnect()
            return

    print(f"[{account.phone}] ✅ подключен")

    # статус обучения
    await sync_to_async(
        lambda: TelegramAccount.objects.filter(id=account.id).update(
            is_training=True, training_status="⏳ Запуск обучения..."
        )
    )()

    # владелец создаваемых TelegramUser
    user_owner = await sync_to_async(lambda: account.user)()

    channels = await sync_to_async(list)(TrainingChannel.objects.filter(is_active=True))

    for channel in channels:
        try:
            await sync_to_async(
                lambda: TelegramAccount.objects.filter(id=account.id).update(
                    training_status=f"📡 Обработка: {channel.username}"
                )
            )()

            print(f"[{account.phone}] 🔄 @{channel.username}")
            entity = await client.get_entity(f"{channel.username}")

            # Определяем целевой чат для сбора (target)
            target = None

            if isinstance(entity, Channel):
                if getattr(entity, "megagroup", False):
                    # Мегагруппа — работаем напрямую
                    target = entity
                    await _ensure_join(client, target)
                else:
                    # Broadcast-канал — ищем связанный discussion-чат
                    full = await client(GetFullChannelRequest(entity))
                    linked_id = getattr(full.full_chat, "linked_chat_id", None)
                    if not linked_id:
                        print(f"[@{channel.username}] 📣 broadcast без связанной группы — участников не получить, скип")
                        continue
                    try:
                        linked_entity = await client.get_entity(linked_id)
                    except Exception:
                        # Иногда без join к исходному каналу не резолвится access_hash
                        await _ensure_join(client, entity)
                        try:
                            linked_entity = await client.get_entity(linked_id)
                        except Exception:
                            print(f"[@{channel.username}] ⚠️ не удалось получить entity связанной группы — скип")
                            continue
                    target = linked_entity
                    await _ensure_join(client, target)

            elif isinstance(entity, Chat):
                # Обычная (не Channel) группа
                target = entity
                await _ensure_join(client, target)

            else:
                print(f"[@{channel.username}] ❌ неизвестный тип — скип")
                continue

            # --- Скан сообщений целевого target ---
            added_from_msgs = 0
            throttle_counter = 0

            async for message in client.iter_messages(target, limit=500000):
                from_id = getattr(message, "from_id", None)
                if not from_id:
                    continue
                user_id = getattr(from_id, "user_id", None)
                if not user_id:
                    continue

                exists = await sync_to_async(
                    TelegramUser.objects.filter(user_id=user_id).exists
                )()
                if exists:
                    continue

                try:
                    user = await client.get_entity(from_id)
                except FloodWaitError as e:
                    print(f"⏳ Flood wait: ждём {e.seconds} сек")
                    await asyncio.sleep(e.seconds)
                    continue
                except Exception as e:
                    print(f"⚠️ ошибка получения user: {e}")
                    await asyncio.sleep(1)
                    continue

                if isinstance(user, User):
                    await sync_to_async(TelegramUser.objects.create)(
                        user_id=user.id,
                        username=user.username,
                        name=f"{user.first_name or ''} {user.last_name or ''}".strip(),
                        phone=user.phone or "",
                        source_channel=channel.username,
                        owner=user_owner,
                        invite_error_code=None,
                        message_error_code=None,
                    )
                    added_from_msgs += 1
                    throttle_counter += 1
                    if throttle_counter >= 30:
                        await asyncio.sleep(20)
                        throttle_counter = 0

            # --- Скан участников (универсально: работает и для Chat, и для Channel) ---
            added_from_participants = 0
            try:
                async for u in client.iter_participants(target, limit=None):
                    exists = await sync_to_async(
                        TelegramUser.objects.filter(user_id=u.id).exists
                    )()
                    if exists:
                        continue

                    await sync_to_async(TelegramUser.objects.create)(
                        user_id=u.id,
                        username=u.username,
                        name=f"{u.first_name or ''} {u.last_name or ''}".strip(),
                        phone=u.phone or "",
                        source_channel=channel.username,
                        owner=user_owner,
                        invite_error_code=None,
                        message_error_code=None,
                    )
                    added_from_participants += 1
                    # лёгкая растяжка, чтобы не бомбить API
                    if (added_from_participants % 200) == 0:
                        await asyncio.sleep(1)
            except FloodWaitError as e:
                print(f"⏳ Flood wait (participants): ждём {e.seconds} сек")
                await asyncio.sleep(e.seconds)
            except Exception as e:
                print(f"⚠️ ошибка получения участников: {e}")

            print(
                f"[@{channel.username}] ✅ добавлено из сообщений: {added_from_msgs}, "
                f"из участников: {added_from_participants}"
            )

        except Exception as e:
            print(f"[@{channel.username}] ⚠️ ошибка: {e}")
            # Не сбрасываем is_training посреди цикла; только обновляем текст статуса
            await sync_to_async(
                lambda: TelegramAccount.objects.filter(id=account.id).update(
                    training_status=f"❌ Ошибка на @{channel.username}: {str(e)[:200]}"
                )
            )()
            continue

    await client.disconnect()
    await sync_to_async(
        lambda: TelegramAccount.objects.filter(id=account.id).update(
            is_training=False, training_status="✅ Обучение завершено"
        )
    )()
    print(f"[{account.phone}] 💫 обучение завершено")


async def main():
    if len(sys.argv) < 2:
        print("❗ usage: python train_account.py <phone>")
        return

    phone = sys.argv[1]
    try:
        account = await sync_to_async(
            lambda: TelegramAccount.objects.select_related("proxy").get(phone=phone)
        )()
    except TelegramAccount.DoesNotExist:
        print(f"❌ аккаунт {phone} не найден")
        return

    await train_account(account)


if __name__ == "__main__":
    asyncio.run(main())
