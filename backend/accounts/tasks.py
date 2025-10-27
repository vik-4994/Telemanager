import os, time
from celery import shared_task
from telethon.sync import TelegramClient
from telethon.tl.functions.channels import InviteToChannelRequest
from telethon.tl.types import PeerChannel
from telethon.errors import FloodWaitError, RPCError
from django.db import transaction
from accounts.models import TelegramAccount, IntermediateChannel
from users.models import TelegramUser
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
import re, random
try:
    import socks
except Exception:
    socks = None

SESSION_DIR = os.path.join(settings.BASE_DIR, "sessions")

def _session_path_for(account):
    fname = account.session_file or f"{account.phone}.session"
    return os.path.join(SESSION_DIR, fname)

def _build_proxy(proxy_obj):
    if not proxy_obj or not socks:
        return None
    t = (proxy_obj.proxy_type or '').lower()
    if t == 'socks5':
        return (socks.SOCKS5, proxy_obj.host, int(proxy_obj.port),
                bool(proxy_obj.username or proxy_obj.password),
                proxy_obj.username, proxy_obj.password)
    if t in ('http', 'https'):
        return (socks.HTTP, proxy_obj.host, int(proxy_obj.port),
                bool(proxy_obj.username or proxy_obj.password),
                proxy_obj.username, proxy_obj.password)
    return None

def _abs_path(p):
    if not p:
        return None
    return p if os.path.isabs(p) else os.path.join(settings.BASE_DIR, p)

def _extract_wait_seconds(err) -> int | None:
    secs = getattr(err, "seconds", None)
    if isinstance(secs, int) and secs > 0: return secs
    s = str(err) or ""
    m = re.search(r"FLOOD_WAIT_(\d+)", s) or re.search(r"(\d+)\s*seconds?", s, re.I)
    return int(m.group(1)) if m else None

def _refill_and_consume_token(account, prefix: str, min_refill_sec: int) -> tuple[bool, int, int]:
    tokens_f = f"{prefix}_tokens"
    cap_f = f"{prefix}_token_capacity"
    at_f = f"{prefix}_token_refill_at"
    refill_f = f"{prefix}_refill_seconds"

    now = timezone.now()
    refill_seconds = max( max(2, int(min_refill_sec)), getattr(account, refill_f) or int(min_refill_sec) )
    last = getattr(account, at_f) or now
    elapsed = max(0, int((now - last).total_seconds()))
    gained = elapsed // refill_seconds

    tokens = getattr(account, tokens_f)
    cap = getattr(account, cap_f)

    if gained > 0:
        tokens = min(cap, tokens + int(gained))
        last = last + timedelta(seconds=int(gained * refill_seconds))

    if tokens <= 0:
        wait_for = max(1, refill_seconds - (elapsed % refill_seconds))
        setattr(account, tokens_f, tokens)
        setattr(account, at_f, last)
        account.save(update_fields=[tokens_f, at_f])
        return (False, wait_for, refill_seconds)

    tokens -= 1
    setattr(account, tokens_f, tokens)
    setattr(account, at_f, last)
    account.save(update_fields=[tokens_f, at_f])
    return (True, 0, refill_seconds)

def _on_success_speedup(account, prefix: str, floor_interval: int, step: float = 0.9, streak_need: int = 5):
    streak_f = f"{prefix}_success_streak"
    refill_f = f"{prefix}_refill_seconds"
    streak = getattr(account, streak_f) + 1
    setattr(account, streak_f, streak)
    if streak >= streak_need:
        new_refill = max(int(floor_interval), int(getattr(account, refill_f) * step))
        setattr(account, refill_f, new_refill)
        setattr(account, streak_f, 0)
        account.save(update_fields=[refill_f, streak_f])
    else:
        account.save(update_fields=[streak_f])

def _on_flood_slowdown(account, prefix: str, wait: int | None):
    tokens_f = f"{prefix}_tokens"
    at_f = f"{prefix}_token_refill_at"
    refill_f = f"{prefix}_refill_seconds"
    streak_f = f"{prefix}_success_streak"

    now = timezone.now()
    setattr(account, tokens_f, 0)
    setattr(account, at_f, now)
    # если сервер дал wait — берём его как минимум; иначе увеличиваем в 1.5–2 раза
    current = getattr(account, refill_f) or 10
    new_refill = max(current, int(wait)) if wait else int(min(current * random.uniform(1.5, 2.0), 600))
    setattr(account, refill_f, max(2, new_refill))
    setattr(account, streak_f, 0)
    account.save(update_fields=[tokens_f, at_f, refill_f, streak_f])


@shared_task(bind=True)
def invite_all_users_task(self, account_id, channel_id, interval=30, owner_user_id=None):
    """
    Приглашение в промежуточный канал ТОЛЬКО пользователей, принадлежащих владельцу аккаунта.
    """
    try:
        account = TelegramAccount.objects.get(id=account_id)
        channel = IntermediateChannel.objects.get(id=channel_id)

        if owner_user_id is None:
            owner_user_id = account.user_id

        session_path = os.path.join("sessions", account.session_file)
        client = TelegramClient(session_path, int(account.api_id), account.api_hash)

        with client:
            entity = client.get_entity(channel.username)
            peer = PeerChannel(entity.id)

            with transaction.atomic():
                candidates = (
                    TelegramUser.objects
                    .select_for_update(skip_locked=True)
                    .filter(owner_id=owner_user_id, invite_status="pending")
                    .order_by("id")[:500]
                )

                users = []
                for user in candidates:
                    user.invite_status = "processing"
                    user.invite_error_code = None
                    if hasattr(user, "processed_by_id"):
                        user.processed_by_id = account_id
                    user.save(update_fields=["invite_status", "invite_error_code", "processed_by_id"] if hasattr(user, "processed_by_id") else ["invite_status", "invite_error_code"])
                    users.append(user)

            to_invite, user_refs = [], []

            for user in users:
                try:
                    # Позволяем остановить задание
                    if TelegramAccount.objects.get(id=account_id).stop_inviting:
                        print("Остановка по флагу stop_inviting")
                        return "Остановлено вручную"

                    tg_user = client.get_entity(user.user_id)
                    to_invite.append(tg_user)
                    user_refs.append(user)
                except Exception as e:
                    print(f"Ошибка get_entity для {user.user_id}: {e}")
                    user.invite_status = "failed"
                    user.invite_error_code = "GET_ENTITY"
                    if hasattr(user, "processed_by_id"):
                        user.processed_by_id = account_id
                    user.save()
                    continue

                if len(to_invite) == 1:
                    try:
                        with transaction.atomic():
                            acc = TelegramAccount.objects.select_for_update().get(id=account.id)
                            ok, wait_for, refill_sec = _refill_and_consume_token(acc, "invite", min_refill_sec=interval)

                        if not ok:
                            if wait_for > 60:
                                for r in user_refs:
                                    if r.invite_status == "processing":
                                        r.invite_status = "pending"
                                        r.save(update_fields=["invite_status"])
                                return f"Invite: нет токенов, подождать ~{wait_for}s (invite_refill_seconds={refill_sec})"
                            time.sleep(wait_for)

                        client(InviteToChannelRequest(peer, to_invite))
                        print(f"Приглашено: {[u.id for u in to_invite]}")
                        for u in user_refs:
                            u.invite_status = "invited"
                            u.invite_error_code = None
                            if hasattr(u, "processed_by_id"):
                                u.processed_by_id = account_id
                            u.save()
                        
                        with transaction.atomic():
                            acc = TelegramAccount.objects.select_for_update().get(id=account.id)
                            _on_success_speedup(acc, "invite", floor_interval=interval)

                        to_invite.clear()
                        user_refs.clear()
                        time.sleep(interval)
                    except FloodWaitError as e:
                        print(f"FloodWait: {e.seconds} сек.")
                        for u in user_refs:
                            u.invite_status = "failed"
                            u.invite_error_code = "FLOOD_WAIT"
                            if hasattr(u, "processed_by_id"):
                                u.processed_by_id = account_id
                            u.save()
                        

                        wait = getattr(e, "seconds", None)  # у RPCError может не быть секунд
                        with transaction.atomic():
                            acc = TelegramAccount.objects.select_for_update().get(id=account.id)
                            _on_flood_slowdown(acc, "invite", wait=wait)


                        time.sleep(e.seconds)
                        to_invite.clear()
                        user_refs.clear()
                    except RPCError as e:
                        print(f"RPC ошибка: {e}")
                        for u in user_refs:
                            u.invite_status = "failed"
                            u.invite_error_code = "RPC_ERROR"
                            if hasattr(u, "processed_by_id"):
                                u.processed_by_id = account_id
                            u.save()

                        wait = getattr(e, "seconds", None)
                        with transaction.atomic():
                            acc = TelegramAccount.objects.select_for_update().get(id=account.id)
                            _on_flood_slowdown(acc, "invite", wait=wait)


                        time.sleep(60)
                        to_invite.clear()
                        user_refs.clear()
                    except Exception as e:
                        print(f"Неизвестная ошибка инвайта: {e}")
                        for u in user_refs:
                            u.invite_status = "failed"
                            u.invite_error_code = "UNKNOWN"
                            if hasattr(u, "processed_by_id"):
                                u.processed_by_id = account_id
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
                        u.invite_error_code = None
                        if hasattr(u, "processed_by_id"):
                            u.processed_by_id = account_id
                        u.save()
                except FloodWaitError as e:
                    print(f"FloodWait в конце: {e.seconds} сек.")
                    for u in user_refs:
                        u.invite_status = "failed"
                        u.invite_error_code = "FLOOD_WAIT"
                        u.save()

                    wait = getattr(e, "seconds", None)
                    with transaction.atomic():
                        acc = TelegramAccount.objects.select_for_update().get(id=account.id)
                        _on_flood_slowdown(acc, "invite", wait=wait)


                    time.sleep(e.seconds)
                except Exception as e:
                    print(f"Финальная ошибка: {e}")
                    for u in user_refs:
                        u.invite_status = "failed"
                        u.invite_error_code = "UNKNOWN"
                        u.save()

        return "Готово"

    except Exception as e:
        return f"Ошибка: {str(e)}"


@shared_task(bind=True)
def send_direct_messages_task(self, account_id, message_text, limit=100, interval=10, media_path=None, owner_user_id=None):
    import os, time, random
    from django.db import transaction
    from telethon.sync import TelegramClient
    from telethon.errors import FloodWaitError, RPCError, PeerIdInvalidError, UserPrivacyRestrictedError
    from accounts.models import TelegramAccount
    from users.models import TelegramUser

    JITTER_MAX = max(1, min(10, int(interval / 2)))
    HARD_STOP_FLOOD = 1800  # сек

    account = TelegramAccount.objects.get(id=account_id)
    if owner_user_id is None:
        owner_user_id = account.user_id

    session_path = _session_path_for(account)
    proxy = _build_proxy(account.proxy)
    media_path = _abs_path(media_path)

    print(f"DM:start acc={account_id} owner={owner_user_id} limit={limit} interval={interval} media={bool(media_path)} -> session={session_path}")

    with transaction.atomic():
        users = list(
            TelegramUser.objects
            .select_for_update(skip_locked=True)
            .filter(
                owner_id=owner_user_id,
                message_status="pending",
                invite_status__in=["pending", "failed", "skipped", "invited", "success"]
            )
            .order_by("id")[:limit]
        )
        for u in users:
            u.message_status = "processing"
            u.message_error_code = None
            if hasattr(u, "processed_by_id"):
                u.processed_by_id = account_id
            u.save(update_fields=["message_status", "message_error_code"] + (["processed_by_id"] if hasattr(u, "processed_by_id") else []))

    if not users:
        msg = f"DM:no-candidates owner={owner_user_id}"
        print(msg)
        return msg

    print(f"DM:users picked {len(users)}")

    sent = failed = 0
    client = TelegramClient(session_path, int(account.api_id), account.api_hash, proxy=proxy)

    try:
        client.connect()
        if not client.is_user_authorized():
            return "DM:not-authorized (session exists but not signed in)"

        for user in users:
            try:
                # Надёжнее выбирать идентификатор: username -> phone -> id
                target = None
                username = getattr(user, "username", None)
                phone = getattr(user, "phone", None)

                if username:
                    target = username if username.startswith("@") else f"@{username}"
                elif phone:
                    target = phone
                else:
                    target = int(user.user_id)

                entity = client.get_entity(target)

                if media_path and os.path.exists(media_path):
                    client.send_file(entity, media_path, caption=message_text)
                else:
                    client.send_message(entity, message_text)

                user.message_status = "sent"
                user.message_error_code = None
                sent += 1

            except FloodWaitError as e:
                print(f"[{getattr(user,'user_id',None)}] FloodWait {e.seconds}s")
                user.message_status = "failed"
                user.message_error_code = "FLOOD_WAIT"
                failed += 1
                if e.seconds >= HARD_STOP_FLOOD:
                    user.save(update_fields=["message_status", "message_error_code"])
                    return f"DM:hard-stop flood={e.seconds}s"
                time.sleep(min(e.seconds, 60))

            except (PeerIdInvalidError, ValueError) as e:
                # Не смогли получить entity по голому ID — частый кейс без access_hash
                user.message_status = "failed"
                user.message_error_code = "PEER_RESOLVE"
                failed += 1

            except UserPrivacyRestrictedError:
                user.message_status = "failed"
                user.message_error_code = "PRIVACY"
                failed += 1

            except RPCError as e:
                print(f"[{getattr(user,'user_id',None)}] RPC {e}")
                user.message_status = "failed"
                user.message_error_code = "RPC_ERROR"
                failed += 1

            except Exception as e:
                print(f"[{getattr(user,'user_id',None)}] UNKNOWN {e}")
                user.message_status = "failed"
                user.message_error_code = "UNKNOWN"
                failed += 1

            finally:
                if hasattr(user, "processed_by_id"):
                    user.processed_by_id = account_id
                user.save(update_fields=["message_status", "message_error_code"] + (["processed_by_id"] if hasattr(user, "processed_by_id") else []))
                time.sleep(interval + random.randint(0, JITTER_MAX))

        result = f"Рассылка завершена аккаунтом {account.phone}: sent={sent}, failed={failed}"
        print(result)
        return result

    finally:
        try:
            client.disconnect()
        except Exception:
            pass



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
