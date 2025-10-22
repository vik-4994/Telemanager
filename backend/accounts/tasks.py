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


from forwarding.models import ForwardingTask, ForwardingGroup
from django.utils import timezone
from telethon.sync import TelegramClient
from telethon.errors import FloodWaitError, RPCError
from telethon.tl.functions.channels import JoinChannelRequest
import os, random, time

@shared_task
def process_forwarding_tasks():
    now = timezone.now()
    tasks = ForwardingTask.objects.filter(is_active=True).select_related('account').prefetch_related('target_groups')

    for task in tasks:
        if task.last_sent_at and (now - task.last_sent_at).total_seconds() < task.interval_minutes * 60:
            continue

        account = task.account
        session_path = os.path.join("sessions", account.session_file)

        try:
            client = TelegramClient(session_path, int(account.api_id), account.api_hash)
            with client:
                try:
                    client(JoinChannelRequest(task.source_channel))
                except RPCError:
                    pass

                messages = client.get_messages(task.source_channel, limit=30)
                if not messages:
                    continue

                message = random.choice(messages)

                for group in task.target_groups.filter(is_active=True):
                    try:
                        try:
                            client(JoinChannelRequest(group.username))
                        except RPCError:
                            pass

                        client.forward_messages(group.username, message)
                    except FloodWaitError as e:
                        time.sleep(e.seconds)
                    except Exception:
                        continue

                task.last_sent_at = now
                task.save()

        except Exception:
            continue


from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.types import PeerChannel, Channel
from forwarding.models import ForwardingTask
from telethon.sync import TelegramClient
from telethon.errors import FloodWaitError, RPCError
from telethon.tl.functions.channels import JoinChannelRequest
from django.utils import timezone
import os, random, time


@shared_task(bind=True)
def process_forwarding_task_by_id(self, task_id):
    try:
        task = ForwardingTask.objects.select_related('account').prefetch_related('target_groups').get(id=task_id)
        account = task.account
        session_path = os.path.join("sessions", account.session_file)

        client = TelegramClient(session_path, int(account.api_id), account.api_hash)

        with client:
            while True:
                task.refresh_from_db()
                if not task.is_active:
                    print(f"🛑 Задача ID={task_id} остановлена")
                    break

                try:
                    source_entity = client.get_entity(task.source_channel)
                    if not isinstance(source_entity, Channel):
                        print(f"❌ {task.source_channel} не является каналом/супергруппой")
                        time.sleep(10)
                        continue
                except Exception as e:
                    print(f"❌ Ошибка получения source_channel: {e}")
                    time.sleep(10)
                    continue

                now = timezone.now()
                if task.last_sent_at and (now - task.last_sent_at).total_seconds() < task.interval_minutes * 60:
                    wait_time = task.interval_minutes * 60 - (now - task.last_sent_at).total_seconds()
                    print(f"⏳ Ждём {int(wait_time)} сек.")
                    time.sleep(wait_time)
                    continue

                messages = client.get_messages(source_entity, limit=6)
                message = next((m for m in messages if m.message), None)
                if not message:
                    print("⚠️ Нет подходящих текстовых сообщений. Пропуск.")
                    time.sleep(task.interval_minutes * 60)
                    continue

                for group in task.target_groups.filter(is_active=True):
                    try:
                        group_entity = client.get_entity(group.username)
                        client.forward_messages(group_entity, message)
                        print(f"📤 Переслано в {group.username}")
                    except FloodWaitError as e:
                        print(f"⏳ FloodWait на {group.username}: ждём {e.seconds} сек")
                        time.sleep(e.seconds)
                        continue
                    except Exception as e:
                        print(f"❌ Ошибка пересылки в {group.username}: {e}")
                        continue

                task.last_sent_at = timezone.now()
                task.save()

                time.sleep(task.interval_minutes * 60)

    except ForwardingTask.DoesNotExist:
        print(f"❌ Задача с ID={task_id} не найдена")
