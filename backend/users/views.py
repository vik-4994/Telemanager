from rest_framework import generics
from .serializers import RegisterSerializer, TelegramUserSerializer, TrainingChannelSerializer
from .models import TelegramUser, TrainingChannel
from django.contrib.auth.models import User
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
        })

class TelegramUserCreateView(generics.CreateAPIView):
    queryset = TelegramUser.objects.all()
    serializer_class = TelegramUserSerializer

class TrainingChannelCreateView(generics.CreateAPIView):
    queryset = TrainingChannel.objects.all()
    serializer_class = TrainingChannelSerializer