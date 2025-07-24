import os, sys, django
from telethon.sync import TelegramClient
from telethon.tl.functions.channels import JoinChannelRequest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "telemanager_django.settings")
django.setup()

from accounts.models import TelegramAccount
from accounts.models import IntermediateChannel

phone = sys.argv[1]
channel_username = sys.argv[2]

account = TelegramAccount.objects.get(phone=phone)

SESSIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "sessions")
session_path = os.path.join(SESSIONS_DIR, account.session_file)

client = TelegramClient(session_path, int(account.api_id), account.api_hash)

with client:
    client.connect()
    client(JoinChannelRequest(channel_username))
    channel = IntermediateChannel.objects.get(username=channel_username)
    channel.added_accounts.add(account)
    print(f"[{phone}] ✅ вступил в {channel_username}")
