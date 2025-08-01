import os
import django
import asyncio
import socks
import time
from telethon.tl.functions.channels import GetParticipantsRequest
from telethon.tl.types import ChannelParticipantsSearch
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.tl.functions.channels import (
    JoinChannelRequest,
    GetFullChannelRequest,
)
from telethon.tl.types import Channel, Chat, User
from telethon.errors import FloodWaitError

from asgiref.sync import sync_to_async

import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "telemanager_django.settings")
django.setup()

from accounts.models import TelegramAccount
from users.models import TrainingChannel, TelegramUser

SESSIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "sessions")


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
        proxy_type = (
            socks.SOCKS5
            if account.proxy.proxy_type == "socks5"
            else socks.HTTP
        )
        proxy = (
            proxy_type,
            account.proxy.host,
            account.proxy.port,
            True if account.proxy.username else False,
            account.proxy.username,
            account.proxy.password,
        )

    client = TelegramClient(
        session_path, int(account.api_id), account.api_hash, proxy=proxy
    )
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

    await sync_to_async(
        lambda: TelegramAccount.objects.filter(id=account.id).update(
            is_training=True, training_status="⏳ Запуск обучения..."
        )
    )()

    channels = await sync_to_async(list)(
        TrainingChannel.objects.filter(is_active=True)
    )

    for channel in channels:
        try:
            await sync_to_async(
                lambda: TelegramAccount.objects.filter(id=account.id).update(
                    training_status=f"📡 Обработка: {channel.username}"
                )
            )()

            print(f"[{account.phone}] 🔄 {channel.username}")
            entity = await client.get_entity(f"{channel.username}")

            if isinstance(entity, Channel):
                full = await client(GetFullChannelRequest(entity))
                linked_id = getattr(full.full_chat, "linked_chat_id", None)
                if not linked_id:
                    print(
                        f"[{channel.username}] ⚠️ нет связанной группы — скип"
                    )
                    continue
                await client(JoinChannelRequest(linked_id))
                group_id = linked_id

            elif isinstance(entity, Chat):
                await client(JoinChannelRequest(f"{channel.username}"))
                group_id = entity.id

            else:
                print(f"[{channel.username}] ❌ неизвестный тип — скип")
                continue

            added = 0
            counter = 0
            async for message in client.iter_messages(group_id, limit=500000):
                user_owner = await sync_to_async(lambda: account.user)()
                if message.from_id:
                    user_id = getattr(message.from_id, "user_id", None)
                    if not user_id:
                        continue

                    exists = await sync_to_async(
                        TelegramUser.objects.filter(user_id=user_id).exists
                    )()
                    if exists:
                        continue

                    try:
                        user = await client.get_entity(message.from_id)
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
                        )

                        added += 1
                        counter += 1
                        if counter == 30:
                            await asyncio.sleep(20)

            offset = 0
            limit = 200

            while True:
                participants = await client(
                    GetParticipantsRequest(
                        channel=group_id,
                        filter=ChannelParticipantsSearch(""),
                        offset=offset,
                        limit=limit,
                        hash=0,
                    )
                )

                if not participants.users:
                    break

                for user in participants.users:
                    exists = await sync_to_async(
                        TelegramUser.objects.filter(user_id=user.id).exists
                    )()
                    if exists:
                        continue

                    await sync_to_async(TelegramUser.objects.create)(
                        user_id=user.id,
                        username=user.username,
                        name=f"{user.first_name or ''} {user.last_name or ''}".strip(),
                        phone=user.phone or "",
                        source_channel=channel.username,
                        owner=user_owner,
                    )

                offset += len(participants.users)
                await asyncio.sleep(
                    1
                ) 

            print(f"[{channel.username}] ✅ добавлено {added} пользователей")

        except Exception as e:
            print(f"[{channel.username}] ⚠️ ошибка: {e}")
            await sync_to_async(
                lambda: TelegramAccount.objects.filter(id=account.id).update(
                    is_training=False,
                    training_status=f"❌ Ошибка: {str(e)[:200]}",
                )
            )()

    await client.disconnect()
    await sync_to_async(
        lambda: TelegramAccount.objects.filter(id=account.id).update(
            is_training=False, training_status="✅ Обучение завершено"
        )
    )()

    print(f"[{account.phone}] 💫 обучение завершено")


async def main():
    import sys

    if len(sys.argv) < 2:
        print("❗ usage: python train_account.py <phone>")
        return

    phone = sys.argv[1]
    try:
        account = await sync_to_async(
            lambda: TelegramAccount.objects.select_related("proxy").get(
                phone=phone
            )
        )()
        await train_account(account)
    except TelegramAccount.DoesNotExist:
        print(f"❌ аккаунт {phone} не найден")


if __name__ == "__main__":
    asyncio.run(main())
