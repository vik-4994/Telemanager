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
import subprocess

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
