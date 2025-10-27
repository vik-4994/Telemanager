import os, json
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from .models import TelegramAccount
from .serializers import TelegramAccountSerializer
from .models import Proxy, IntermediateChannel
from .serializers import ProxySerializer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import generics
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from accounts.tasks import invite_all_users_task, send_direct_messages_task
import subprocess
from celery.app.control import Control
from asgiref.sync import async_to_sync
from django.http import JsonResponse, FileResponse
from telethon.errors import RPCError
from celery import current_app
# from telethon.sync import TelegramClient
from telethon.tl import functions, types
from telethon.errors import (
    PhoneCodeInvalidError, SessionPasswordNeededError, PhoneCodeExpiredError,
    ApiIdInvalidError, PhoneNumberInvalidError
)
from telethon.errors.rpcerrorlist import FloodWaitError
import asyncio
import socks
from rest_framework.decorators import parser_classes
from telethon import TelegramClient

revoke = current_app.control.revoke

SESSION_DIR = os.path.join(settings.BASE_DIR, "sessions")
os.makedirs(SESSION_DIR, exist_ok=True)


def session_path_for(phone: str) -> str:
    return os.path.join(SESSION_DIR, phone.strip().replace(" ", ""))

class TelegramAccountListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        accounts = TelegramAccount.objects.filter(user=request.user)
        serializer = TelegramAccountSerializer(accounts, many=True)
        return Response(serializer.data)


class UploadTelegramAccountView(APIView):
    parser_classes = [MultiPartParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        json_file = request.FILES.get("json")
        session_file = request.FILES.get("session")

        if not json_file or not session_file:
            return Response({"error": "Оба файла обязательны"}, status=400)

        data = json.load(json_file)
        api_id = data.get("app_id")
        api_hash = data.get("app_hash")
        twofa_password = data.get("twoFA") or data.get("2fa_password")
        phone = data.get("phone")
        session_filename = f"{phone}.session"
        session_path = os.path.join(settings.BASE_DIR, "sessions", session_filename)

        os.makedirs(os.path.dirname(session_path), exist_ok=True)
        with open(session_path, "wb") as f:
            for chunk in session_file.chunks():
                f.write(chunk)


        proxy_data = data.get("proxy")
        proxy_obj = None
        if proxy_data and proxy_data.get("host") and proxy_data.get("port"):
            proxy_obj, _ = Proxy.objects.get_or_create(
                host=proxy_data.get("host"),
                port=proxy_data.get("port"),
                defaults={
                    "username": proxy_data.get("username"),
                    "password": proxy_data.get("password")
                }
            )


        TelegramAccount.objects.update_or_create(
            user=request.user,
            phone=phone,
            defaults={
                "geo": phone[:2],
                "name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
                "status": "активен",
                "days_idle": "n/a",
                "role": data.get("role") or "-",
                "session_file": session_filename,
                "proxy": proxy_obj,
                "api_id": api_id,
                "api_hash": api_hash,
                "twofa_password": twofa_password,
            }
        )

        return Response({"message": "Аккаунт добавлен"})
    

class ProxyListCreateView(generics.ListCreateAPIView):
    queryset = Proxy.objects.all()
    serializer_class = ProxySerializer
    permission_classes = [IsAuthenticated]


class ProxyDestroyView(generics.DestroyAPIView):
    queryset = Proxy.objects.all()
    serializer_class = ProxySerializer
    permission_classes = [IsAuthenticated]


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def set_account_proxy(request, account_id):
    try:
        account = TelegramAccount.objects.get(id=account_id, user=request.user)
    except TelegramAccount.DoesNotExist:
        return Response({"error": "Аккаунт не найден"}, status=404)

    proxy_id = request.data.get("proxy_id")
    if proxy_id:
        try:
            proxy = Proxy.objects.get(id=proxy_id)
            account.proxy = proxy
        except Proxy.DoesNotExist:
            return Response({"error": "Прокси не найден"}, status=400)
    else:
        account.proxy = None

    account.save()
    return Response({"message": "Прокси обновлён"})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_account(request, account_id):
    try:
        account = TelegramAccount.objects.get(id=account_id, user=request.user)
    except TelegramAccount.DoesNotExist:
        return Response({'error': 'Аккаунт не найден'}, status=404)

    account.delete()
    return Response({'message': 'Аккаунт удалён'}, status=204)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def check_all_accounts_view(request):
    script_path = os.path.join(os.path.dirname(__file__), 'check_all_accounts.py')

    try:
        subprocess.Popen(['python3', script_path])
        return JsonResponse({'message': 'Проверка запущена'}, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
    

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def train_account_view(request, account_id):
    from .models import TelegramAccount
    try:
        account = TelegramAccount.objects.get(id=account_id, user=request.user)
    except TelegramAccount.DoesNotExist:
        return JsonResponse({"error": "Аккаунт не найден"}, status=404)

    phone = account.phone
    script_path = os.path.join(os.path.dirname(__file__), 'train_account.py')

    try:
        subprocess.Popen(['python3', script_path, phone])
        return JsonResponse({'message': f'Обучение аккаунта {phone} запущено'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
    

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_intermediate_channel(request):
    username = request.data.get('username')
    if not username or not username.startswith('@'):
        return Response({'error': 'Неверный username'}, status=400)

    obj, created = IntermediateChannel.objects.get_or_create(username=username)
    return Response({
        'id': obj.id,
        'username': obj.username,
        'created': created
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_intermediate_channels(request):
    channels = IntermediateChannel.objects.all().order_by('-created_at')
    data = [
        {
            'id': c.id,
            'username': c.username,
            'title': c.title,
            'accounts': [acc.phone for acc in c.added_accounts.all()]
        }
        for c in channels
    ]
    return Response(data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_intermediate_channel(request, pk):
    try:
        channel = IntermediateChannel.objects.get(id=pk)
        channel.delete()
        return Response({'status': 'deleted'})
    except IntermediateChannel.DoesNotExist:
        return Response({'error': 'Канал не найден'}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_account_to_intermediate_channel(request, pk):
    account_id = request.data.get('account_id')

    try:
        account = TelegramAccount.objects.get(id=account_id, user=request.user)
    except TelegramAccount.DoesNotExist:
        return Response({'error': 'Аккаунт не найден'}, status=404)

    try:
        channel = IntermediateChannel.objects.get(id=pk)
    except IntermediateChannel.DoesNotExist:
        return Response({'error': 'Канал не найден'}, status=404)

    script_path = os.path.join(os.path.dirname(__file__), 'join_channel.py')

    try:
        subprocess.Popen(['python3', script_path, account.phone, channel.username])
        return Response({'message': f'Добавление аккаунта {account.phone} в {channel.username} запущено'})
    except Exception as e:
        return Response({'error': str(e)}, status=500)


# --- invite_all_users_view ---
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_all_users_view(request):
    account_id = request.data.get('account_id')
    channel_id = request.data.get('channel_id')

    try: interval = int(request.data.get('interval', 30))
    except: interval = 30
    interval = max(2, min(300, interval))

    if not all([account_id, channel_id]):
        return Response({'error': 'Нужен account_id и channel_id'}, status=400)

    try:
        account = TelegramAccount.objects.get(id=account_id, user=request.user)
    except TelegramAccount.DoesNotExist:
        return Response({'error': 'Аккаунт не найден'}, status=404)

    from django.utils import timezone
    now = timezone.now()
    if getattr(account, "cooldown_until", None) and now < account.cooldown_until:
        return Response({'error': 'Аккаунт в кулдауне', 'cooldown_until': account.cooldown_until}, status=429)

    task = invite_all_users_task.delay(
        account_id=account.id,
        channel_id=channel_id,
        interval=interval,
        owner_user_id=request.user.id,
    )

    account.stop_inviting = False
    account.invite_task_id = task.id
    account.save(update_fields=["stop_inviting","invite_task_id"])

    return Response({'message': 'Инвайт запущен', 'task_id': task.id, 'accepted': {'interval': interval}})



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stop_invite_task(request):
    account_id = request.data.get("account_id")
    try:
        account = TelegramAccount.objects.get(id=account_id, user=request.user)
        if not account.invite_task_id:
            return Response({"error": "Задача не найдена"}, status=404)

        revoke(account.invite_task_id, terminate=True)
        account.stop_inviting = True
        account.invite_task_id = None
        account.save()

        return Response({"message": "Задача остановлена"})
    except TelegramAccount.DoesNotExist:
        return Response({"error": "Аккаунт не найден"}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_code_view(request):
    data = request.data
    phone = (data.get("phone") or "").strip()
    api_id = data.get("api_id")
    api_hash = data.get("api_hash")
    force_sms = bool(data.get("force_sms", False))

    if not all([phone, api_id, api_hash]):
        return Response({"error": "Нужно указать phone, api_id и api_hash"}, status=400)

    session_name = session_path_for(phone)

    async def _send_code_async():
        client = TelegramClient(session_name, int(api_id), api_hash)
        await client.connect()
        try:
            res = await client.send_code_request(phone, force_sms=force_sms)
            return res.phone_code_hash
        finally:
            await client.disconnect()

    try:
        phone_code_hash = async_to_sync(_send_code_async)()   # ← запускаем async безопасно
        # ORM — только в sync:
        TelegramAccount.objects.update_or_create(
            user=request.user,
            phone=phone,
            defaults={
                "api_id": int(api_id),
                "api_hash": api_hash,
                "session_file": f"{phone}.session",
                "phone_code_hash": phone_code_hash,
            },
        )
        return Response({"message": "Код отправлен"})
    except FloodWaitError as e:
        return Response({"error": f"Flood wait: подождите {e.seconds} сек."}, status=429)
    except (ApiIdInvalidError, PhoneNumberInvalidError) as e:
        return Response({"error": str(e)}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


from telethon.errors import PhoneCodeInvalidError, SessionPasswordNeededError

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sign_in_view(request):
    data = request.data
    phone = (data.get("phone") or "").strip()
    code = (data.get("code") or "").strip()
    password = data.get("password", "")

    if not all([phone, code]):
        return Response({"error": "Нужно указать phone и code"}, status=400)

    try:
        account = TelegramAccount.objects.get(phone=phone, user=request.user)
    except TelegramAccount.DoesNotExist:
        return Response({"error": "Аккаунт не найден"}, status=404)

    if not account.phone_code_hash:
        return Response({"error": "Сначала запросите код (/send_code/)"},
                        status=400)

    session_name = session_path_for(phone)

    async def _sign_in_async():
        client = TelegramClient(session_name, int(account.api_id), account.api_hash)
        await client.connect()
        try:
            try:
                # Низкоуровневый RPC с явным phone_code_hash
                await client(functions.auth.SignInRequest(
                    phone_number=phone,
                    phone_code_hash=account.phone_code_hash,
                    phone_code=code,
                ))
            except SessionPasswordNeededError:
                if not password:
                    raise
                await client.sign_in(password=password)

            me = await client.get_me()
            return {
                "first_name": (me.first_name or "").strip(),
                "last_name": (me.last_name or "").strip(),
            }
        finally:
            await client.disconnect()

    try:
        me_info = async_to_sync(_sign_in_async)()  # ← запускаем async-часть
        # ← А вот это уже синхронно: безопасно для ORM
        account.name = f"{me_info['first_name']} {me_info['last_name']}".strip()
        account.status = "активен"
        account.phone_code_hash = None
        if password:
            account.twofa_password = password
        account.save()
        return Response({"message": "Успешно авторизовано"})
    except PhoneCodeInvalidError:
        return Response({"error": "Неверный код"}, status=401)
    except PhoneCodeExpiredError:
        return Response({"error": "Срок действия кода истёк, запросите новый"}, status=401)
    except SessionPasswordNeededError:
        return Response({"error": "Нужен пароль 2FA"}, status=403)
    except FloodWaitError as e:
        return Response({"error": f"Flood wait: подождите {e.seconds} сек."}, status=429)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def send_direct_messages_view(request):
    account_id = request.data.get("account_id")
    message = request.data.get("message_text")

    def _to_int(v, dv): 
        try: return int(v)
        except: return dv

    limit = max(1, min(1000, _to_int(request.data.get("limit", 100), 100)))
    interval = max(2, min(300, _to_int(request.data.get("interval", 10), 10)))
    media_file = request.FILES.get("media")

    if not account_id or not message:
        return Response({"error": "Нужен account_id и message_text"}, status=400)

    try:
        account = TelegramAccount.objects.get(id=account_id, user=request.user)
    except TelegramAccount.DoesNotExist:
        return Response({"error": "Аккаунт не найден"}, status=404)

    from django.utils import timezone
    now = timezone.now()
    if getattr(account, "cooldown_until", None) and now < account.cooldown_until:
        return Response({"error": "Аккаунт в кулдауне", "cooldown_until": account.cooldown_until}, status=429)

    if media_file:
        os.makedirs("media", exist_ok=True)
        fname = os.path.basename(media_file.name)
        media_path = os.path.join("media", fname)
        with open(media_path, "wb+") as f:
            for chunk in media_file.chunks():
                f.write(chunk)
    else:
        media_path = None

    task = send_direct_messages_task.delay(
        account_id=account.id,
        message_text=message,
        limit=limit,
        interval=interval,
        media_path=media_path,
        owner_user_id=request.user.id,
    )

    return Response({"message": "Задача рассылки запущена", "task_id": task.id, "accepted": {"limit": limit, "interval": interval}})



def _build_proxy(proxy_obj: Proxy | None):
    if not proxy_obj or not socks:
        return None
    t = (proxy_obj.proxy_type or '').lower()
    if t == 'socks5':
        return (socks.SOCKS5, proxy_obj.host, int(proxy_obj.port),
                True if (proxy_obj.username or proxy_obj.password) else False,
                proxy_obj.username, proxy_obj.password)
    # Для http/https Telethon тоже использует PySocks
    if t in ('http', 'https'):
        return (socks.HTTP, proxy_obj.host, int(proxy_obj.port),
                True if (proxy_obj.username or proxy_obj.password) else False,
                proxy_obj.username, proxy_obj.password)
    return None

# async def _with_client(account: TelegramAccount, coro):
#     """Вспомогательный раннер: откроет клиент, выполнит корутину и закроет."""
#     session_path = session_path_for(account.phone)
#     proxy = _build_proxy(account.proxy)
#     async with TelegramClient(session_path, int(account.api_id), account.api_hash, proxy=proxy) as client:
#         return await coro(client)


async def _with_client(account: TelegramAccount, coro):
    """
    Открываем клиент БЕЗ start(), явно connect()/disconnect(),
    чтобы Telethon не спрашивал телефон.
    """
    session_path = session_path_for(account.phone)
    proxy = _build_proxy(account.proxy)
    client = TelegramClient(session_path, int(account.api_id), account.api_hash, proxy=proxy)
    await client.connect()
    try:
        # Не уходим в интерактив – сами проверяем авторизацию
        if not await client.is_user_authorized():
            raise RuntimeError("Session exists but is not authorized")
        return await coro(client)
    finally:
        await client.disconnect()

AVATAR_DIR = os.path.join(settings.MEDIA_ROOT, "tg_avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)

def avatar_abspath(account):
    # Фиксированное имя на аккаунт; можно по phone, но id стабильнее.
    return os.path.join(AVATAR_DIR, f"tg_{account.id}.jpg")

class TelegramProfileView(APIView):
    """
    GET  /api/accounts/<id>/profile/
    PATCH /api/accounts/<id>/profile/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, account_id):
        try:
            account = TelegramAccount.objects.get(id=account_id, user=request.user)
        except TelegramAccount.DoesNotExist:
            return Response({'error': 'Аккаунт не найден'}, status=404)

        async def job(client):
            me = await client.get_me()
            full = await client(functions.users.GetFullUserRequest(me.id))
            about = getattr(full.full_user, 'about', '') or ''
            has_photo = bool(getattr(me, 'photo', None))
            return {
                'username': me.username or '',
                'first_name': me.first_name or '',
                'last_name': me.last_name or '',
                'about': about,
                'has_photo': has_photo,
            }

        try:
            data = async_to_sync(_with_client)(account, job)  # как в send_code/sign_in
            return Response(data)
        except FloodWaitError as e:
            return Response({'error': f'Flood wait: подождите {e.seconds} сек.'}, status=429)
        except RPCError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def patch(self, request, account_id):
        try:
            account = TelegramAccount.objects.get(id=account_id, user=request.user)
        except TelegramAccount.DoesNotExist:
            return Response({'error': 'Аккаунт не найден'}, status=404)

        desired_username = (request.data.get('username') or '').strip().lstrip('@')
        first_name = request.data.get('first_name')
        last_name  = request.data.get('last_name')
        about      = request.data.get('about')

        async def job(client):
            me = await client.get_me()
            current_username = (me.username or '')

            # Меняем username только если реально другой (без учёта регистра и @)
            if desired_username and desired_username.lower() != current_username.lower():
                await client(functions.account.UpdateUsernameRequest(username=desired_username))

            # Имя/фамилия/описание — только если что-то передали
            if any(v is not None for v in (first_name, last_name, about)):
                await client(functions.account.UpdateProfileRequest(
                    first_name=first_name if first_name is not None else None,
                    last_name=last_name if last_name is not None else None,
                    about=about if about is not None else None,
                ))

            me2 = await client.get_me()
            full2 = await client(functions.users.GetFullUserRequest(me2.id))
            return {
                'username': me2.username or '',
                'first_name': me2.first_name or '',
                'last_name': me2.last_name or '',
                'about': getattr(full2.full_user, 'about', '') or '',
            }

        try:
            data = async_to_sync(_with_client)(account, job)
            return Response(data)
        except UsernameOccupiedError:
            return Response({'error': 'Username уже занят'}, status=400)
        except UsernameInvalidError:
            return Response({'error': 'Некорректный username'}, status=400)
        except FloodWaitError as e:
            return Response({'error': f'Flood wait: подождите {e.seconds} сек.'}, status=429)
        except RPCError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class TelegramProfilePhotoView(APIView):
    """
    POST /api/accounts/<id>/profile/photo/  multipart {photo}
    """
    parser_classes = [MultiPartParser]
    permission_classes = [IsAuthenticated]

    def get(self, request, account_id):
        from .models import TelegramAccount
        try:
            account = TelegramAccount.objects.get(id=account_id, user=request.user)
        except TelegramAccount.DoesNotExist:
            return Response({'error': 'Аккаунт не найден'}, status=404)

        path = avatar_abspath(account)
        force = request.GET.get("refresh") in ("1", "true", "yes")

        async def job(client):
            return await client.download_profile_photo("me", file=path)

        try:
            if force or not os.path.exists(path) or os.path.getsize(path) == 0:
                res = async_to_sync(_with_client)(account, job)
                if not res:
                    if os.path.exists(path):
                        try: os.remove(path)
                        except: pass
                    return Response({'error': 'No profile photo'}, status=404)

            # Отдаём файл как картинку
            if not os.path.exists(path) or os.path.getsize(path) == 0:
                return Response({'error': 'No profile photo'}, status=404)

            resp = FileResponse(open(path, "rb"), content_type="image/jpeg")
            resp["Cache-Control"] = "max-age=3600, public"
            resp["Content-Disposition"] = 'inline; filename="avatar.jpg"'
            return resp

        except RuntimeError as e:
            return Response({"error": str(e), "action": "sign_in_required"}, status=409)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def post(self, request, account_id):
        try:
            account = TelegramAccount.objects.get(id=account_id, user=request.user)
        except TelegramAccount.DoesNotExist:
            return Response({'error': 'Аккаунт не найден'}, status=404)

        photo = request.FILES.get('photo')
        if not photo:
            return Response({'error': 'Файл не передан'}, status=400)

        # (по желанию) простая валидация формата/размера
        if photo.size > 5 * 1024 * 1024:
            return Response({'error': 'Фото больше 5 МБ'}, status=400)

        async def job(client):
            up = await client.upload_file(photo)
            await client(functions.photos.UploadProfilePhotoRequest(file=up))
            return {'ok': True}

        try:
            async_to_sync(_with_client)(account, job)    # ← заменили asyncio.run на async_to_sync
            return Response({'message': 'Фото обновлено'})
        except FloodWaitError as e:
            return Response({'error': f'Flood wait: подождите {e.seconds} сек.'}, status=429)
        except RPCError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
