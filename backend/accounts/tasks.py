import os, time
from celery import shared_task
from telethon.sync import TelegramClient
from telethon.tl.functions.channels import InviteToChannelRequest
from telethon.tl.types import PeerChannel
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
            users = TelegramUser.objects.all()[:500]  # лимит на всякий случай

            to_invite = []
            print(users)
            for user in users:
                try:
                    tg_user = client.get_entity(user.user_id)
                    to_invite.append(tg_user)
                except Exception:
                    continue

                if len(to_invite) == 5:
                    try:
                        client(InviteToChannelRequest(peer, to_invite))
                        print(f"✅ Приглашено: {len(to_invite)}")
                        to_invite = []
                        time.sleep(interval)
                    except Exception as e:
                        print(f"⚠️ Ошибка инвайта: {e}")
                        time.sleep(60)

            if to_invite:
                try:
                    client(InviteToChannelRequest(peer, to_invite))
                    print(f"✅ Приглашено финально: {len(to_invite)}")
                except:
                    pass

        return "✅ Готово"

    except Exception as e:
        return f"❌ Ошибка: {str(e)}"
