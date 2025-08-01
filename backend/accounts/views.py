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
from celery import current_app
from telethon.sync import TelegramClient
from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError
from django.conf import settings
import asyncio
from rest_framework.decorators import parser_classes
from rest_framework.parsers import MultiPartParser

revoke = current_app.control.revoke



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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_all_users_view(request):
    account_id = request.data.get('account_id')
    channel_id = request.data.get('channel_id')
    interval = int(request.data.get('interval', 30))

    if not all([account_id, channel_id]):
        return Response({'error': 'Нужен account_id и channel_id'}, status=400)

    try:
        account = TelegramAccount.objects.get(id=account_id, user=request.user)
    except TelegramAccount.DoesNotExist:
        return Response({'error': 'Аккаунт не найден'}, status=404)

    task = invite_all_users_task.delay(account_id, channel_id, interval)

    account.stop_inviting = False
    account.invite_task_id = task.id
    account.save()


    return Response({'message': 'Инвайт запущен', 'task_id': task.id})


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
    phone = data.get("phone")
    api_id = data.get("api_id")
    api_hash = data.get("api_hash")

    if not all([phone, api_id, api_hash]):
        return Response({"error": "Нужно указать phone, api_id и api_hash"}, status=400)

    session_dir = os.path.join(settings.BASE_DIR, "sessions")
    os.makedirs(session_dir, exist_ok=True)
    session_name = os.path.join("sessions", phone) 

    async def send():
        async with TelegramClient(session_name, api_id, api_hash) as client:
            result = await client.send_code_request(phone)
            phone_code_hash = result.phone_code_hash

            TelegramAccount.objects.update_or_create(
                user=request.user,
                phone=phone,
                defaults={
                    "api_id": api_id,
                    "api_hash": api_hash,
                    "session_file": f"{phone}.session",
                    "phone_code_hash": phone_code_hash,
                },
            )

    try:
        asyncio.run(send())
        return Response({"message": "Код отправлен"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)

from telethon.errors import PhoneCodeInvalidError, SessionPasswordNeededError

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sign_in_view(request):
    data = request.data
    phone = data.get("phone")
    code = data.get("code")
    password = data.get("password", "")

    if not all([phone, code]):
        return Response({"error": "Нужно указать phone и code"}, status=400)

    try:
        account = TelegramAccount.objects.get(phone=phone, user=request.user)
    except TelegramAccount.DoesNotExist:
        return Response({"error": "Аккаунт не найден"}, status=404)

    session_name = os.path.join("sessions", phone)

    async def login():
        async with TelegramClient(session_name, account.api_id, account.api_hash) as client:
            try:
                await client.sign_in(phone=phone, code=code, phone_code_hash=account.phone_code_hash)
            except SessionPasswordNeededError:
                await client.sign_in(password=password)

            me = await client.get_me()
            account.name = f"{me.first_name} {me.last_name or ''}".strip()
            account.status = "активен"
            account.phone_code_hash = None
            account.twofa_password = password
            account.save()

    try:
        asyncio.run(login())
        return Response({"message": "Успешно авторизовано"})
    except PhoneCodeInvalidError:
        return Response({"error": "Неверный код"}, status=401)
    except SessionPasswordNeededError:
        return Response({"error": "Нужен пароль от Telegram"}, status=403)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def send_direct_messages_view(request):
    account_id = request.data.get("account_id")
    message = request.data.get("message_text")
    limit = int(request.data.get("limit", 100))
    interval = int(request.data.get("interval", 10))
    media_file = request.FILES.get("media")

    if not account_id or not message:
        return Response({"error": "Нужен account_id и message_text"}, status=400)

    if media_file:
        media_path = os.path.join("media", media_file.name)
        os.makedirs("media", exist_ok=True)
        with open(media_path, "wb+") as f:
            for chunk in media_file.chunks():
                f.write(chunk)
    else:
        media_path = None

    task = send_direct_messages_task.delay(account_id, message, limit, interval, media_path)
    return Response({"message": "Задача рассылки запущена", "task_id": task.id})
