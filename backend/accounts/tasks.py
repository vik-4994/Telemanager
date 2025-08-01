import os, time
from celery import shared_task
from telethon.sync import TelegramClient
from telethon.tl.functions.channels import InviteToChannelRequest
from telethon.tl.types import PeerChannel
from telethon.errors import FloodWaitError, RPCError
from django.db import transaction
from accounts.models import TelegramAccount, IntermediateChannel
from users.models import TelegramUser

@shared_task(bind=True)
def invite_all_users_task(self, account_id, channel_id, interval=30):
    try:
        account = TelegramAccount.objects.get(id=account_id)
        channel = IntermediateChannel.objects.get(id=channel_id)

        session_path = os.path.join("sessions", account.session_file)
        client = TelegramClient(session_path, int(account.api_id), account.api_hash)

        with client:
            entity = client.get_entity(channel.username)
            peer = PeerChannel(entity.id)
            users = []
            with transaction.atomic():
                candidates = TelegramUser.objects.select_for_update(skip_locked=True).filter(invite_status="pending")[:500]
                for user in candidates:
                    user.invite_status = "processing"
                    user.save()
                    users.append(user)

            to_invite = []
            user_refs = []

            for user in users:
                try:
                    if TelegramAccount.objects.get(id=account_id).stop_inviting:
                        print("Остановка по флагу stop_inviting")
                        return "Остановлено вручную"


                    tg_user = client.get_entity(user.user_id)
                    to_invite.append(tg_user)
                    user_refs.append(user)
                except Exception as e:
                    print(f"Ошибка get_entity для {user.user_id}: {e}")
                    user.invite_status = "skipped"
                    user.save()
                    continue

                if len(to_invite) == 1:
                    try:
                        client(InviteToChannelRequest(peer, to_invite))
                        print(f"Приглашено: {[u.id for u in to_invite]}")
                        for u in user_refs:
                            u.invite_status = "invited"
                            u.save()
                        to_invite.clear()
                        user_refs.clear()
                        time.sleep(interval)
                    except FloodWaitError as e:
                        print(f"FloodWait: {e.seconds} сек.")
                        for u in user_refs:
                            u.invite_status = "floodwait"
                            u.save()
                        time.sleep(e.seconds)
                        to_invite.clear()
                        user_refs.clear()
                    except RPCError as e:
                        print(f"RPC ошибка: {e}")
                        for u in user_refs:
                            u.invite_status = "failed"
                            u.save()
                        time.sleep(60)
                        to_invite.clear()
                        user_refs.clear()
                    except Exception as e:
                        print(f"Неизвестная ошибка инвайта: {e}")
                        for u in user_refs:
                            u.invite_status = "failed"
                            u.save()
                        time.sleep(60)
                        to_invite.clear()
                        user_refs.clear()

            if to_invite:
                try:
                    client(InviteToChannelRequest(peer, to_invite))
                    print(f"Приглашено финально: {[u.id for u in to_invite]}")
                    for u in user_refs:
                        u.invite_status = "invited"
                        u.save()
                except FloodWaitError as e:
                    print(f"FloodWait в конце: {e.seconds} сек.")
                    for u in user_refs:
                        u.invite_status = "floodwait"
                        u.save()
                    time.sleep(e.seconds)
                except Exception as e:
                    print(f"Финальная ошибка: {e}")
                    for u in user_refs:
                        u.invite_status = "failed"
                        u.save()

        return "Готово"

    except Exception as e:
        return f"Ошибка: {str(e)}"


@shared_task(bind=True)
def send_direct_messages_task(self, account_id, message_text, limit=100, interval=10, media_path=None):
    import os, time
    from accounts.models import TelegramAccount
    from users.models import TelegramUser
    from django.db import transaction
    from telethon.sync import TelegramClient
    from telethon.errors import (
        FloodWaitError,
        RPCError,
        PeerIdInvalidError,
        UserPrivacyRestrictedError,
    )

    account = TelegramAccount.objects.get(id=account_id)
    session_path = os.path.join("sessions", account.session_file)
    client = TelegramClient(session_path, int(account.api_id), account.api_hash)

    with client:
        with transaction.atomic():
            users = list(
                TelegramUser.objects
                .select_for_update(skip_locked=True)
                .filter(
                    message_status="pending",
                    invite_status__in=["pending", "failed", "skipped"]
                )[:limit]
            )
            for u in users:
                u.message_status = "processing"
                u.save()

        # Рассылка сообщений
        for user in users:
            try:
                entity = client.get_entity(user.user_id)

                if media_path and os.path.exists(media_path):
                    client.send_file(entity, media_path, caption=message_text)
                else:
                    client.send_message(entity, message_text)

                user.message_status = "sent"

            except FloodWaitError as e:
                print(f"[{user.user_id}] ⏳ FloodWait: {e.seconds} сек")
                time.sleep(e.seconds)
                continue

            except UserPrivacyRestrictedError as e:
                print(f"[{user.user_id}] 🚫 Приватность: {e}")
                user.message_status = "skipped"

            except (PeerIdInvalidError, RPCError) as e:
                print(f"[{user.user_id}] RPC ошибка: {e}")
                user.message_status = "failed"

            except Exception as e:
                print(f"[{user.user_id}] ❗ Неизвестная ошибка: {e}")
                user.message_status = "failed"

            user.save()
            time.sleep(interval)

    return f"Рассылка завершена аккаунтом {account.phone}"
