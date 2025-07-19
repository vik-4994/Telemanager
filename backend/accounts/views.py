import os, json
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from .models import TelegramAccount
from .serializers import TelegramAccountSerializer
from .models import Proxy
from .serializers import ProxySerializer
from rest_framework import generics

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
        phone = data.get("phone")
        session_filename = f"{phone}.session"
        session_path = os.path.join(settings.BASE_DIR, "sessions", session_filename)

        os.makedirs(os.path.dirname(session_path), exist_ok=True)
        with open(session_path, "wb") as f:
            for chunk in session_file.chunks():
                f.write(chunk)

        # --- Работа с прокси ---
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

        # --- Создание/обновление аккаунта ---
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
                "proxy": proxy_obj
            }
        )

        return Response({"message": "Аккаунт добавлен"})
    

class ProxyListCreateView(generics.ListCreateAPIView):
    queryset = Proxy.objects.all()
    serializer_class = ProxySerializer
    permission_classes = [IsAuthenticated]