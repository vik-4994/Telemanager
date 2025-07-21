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

class TrainingChannelListView(generics.ListAPIView):
    queryset = TrainingChannel.objects.all()
    serializer_class = TrainingChannelSerializer

class TrainingChannelDeleteView(generics.DestroyAPIView):
    queryset = TrainingChannel.objects.all()
    lookup_field = 'id'

class TrainingChannelToggleActiveView(APIView):
    def post(self, request, id):
        try:
            channel = TrainingChannel.objects.get(id=id)
            channel.is_active = not channel.is_active
            channel.save()
            return Response({"status": "ok", "is_active": channel.is_active})
        except TrainingChannel.DoesNotExist:
            return Response({"error": "Channel not found"}, status=404)