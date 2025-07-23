from telethon.sync import TelegramClient
from telethon.tl.functions.channels import JoinChannelRequest
import os, sys, django

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "telemanager_django.settings")
django.setup()

from accounts.models import TelegramAccount
from users.models import IntermediateChannel

phone = sys.argv[1]
channel_username = sys.argv[2]

account = TelegramAccount.objects.get(phone=phone)
client = TelegramClient(os.path.join('..', 'sessions', account.session_file), int(account.api_id), account.api_hash)

with client:
    client(JoinChannelRequest(channel_username))
    channel = IntermediateChannel.objects.get(username=channel_username)
    channel.added_accounts.add(account)
    print(f"[{phone}] ✅ joined {channel_username}")
