import os
import django
import asyncio
import socks

from telethon import TelegramClient
from telethon.errors import RPCError
from telethon.sessions import SQLiteSession
from asgiref.sync import sync_to_async

import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "telemanager_django.settings")
django.setup()

from accounts.models import TelegramAccount

SESSIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "sessions")

async def check_account(account: TelegramAccount):
    session_path = os.path.join(SESSIONS_DIR, f"{account.phone}.session")

    if not os.path.exists(session_path):
        print(f"[{account.phone}] Session not found")
        account.status = "мёртвый"
        await sync_to_async(account.save)()
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
            account.proxy.password
        )

    try:
        api_id = account.api_id
        api_hash = account.api_hash

        if not api_id or not api_hash:
            print(f"[{account.phone}] Пропущен: отсутствует api_id или api_hash")
            account.status = "нет ключей"
            await sync_to_async(account.save)()
            return

        client = TelegramClient(session_path, int(api_id), api_hash, proxy=proxy)

        await client.connect()

        if not await client.is_user_authorized():
            print(f"[{account.phone}] Unauthorized")
            account.status = "мёртвый"
        else:
            me = await client.get_me()
            print(f"[{account.phone}] ✅ Активен как {me.first_name}")
            account.status = "активен"

        await client.disconnect()
    except RPCError as e:
        print(f"[{account.phone}] RPC Error: {e}")
        account.status = "мёртвый"
    except Exception as e:
        print(f"[{account.phone}] Ошибка: {e}")
        account.status = "мёртвый"
    finally:
        await sync_to_async(account.save)()


async def main():
    accounts = await sync_to_async(list)(
        TelegramAccount.objects.select_related('proxy').all()
    )

    tasks = [check_account(acc) for acc in accounts]
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
