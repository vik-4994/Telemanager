from django.contrib.auth.models import User
from .models import TelegramUser, TrainingChannel
from rest_framework import serializers


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password"]

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        return user


class TelegramUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelegramUser
        fields = "__all__"


class TrainingChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingChannel
        fields = "__all__"


class ProcessedUserSerializer(serializers.ModelSerializer):
    processed = serializers.SerializerMethodField()

    class Meta:
        model = TelegramUser
        fields = [
            "id", "user_id", "username", "name", "phone",
            "source_channel", "invite_status", "message_status", "processed"
        ]

    def get_processed(self, obj):
        return (
            obj.invite_status in ("success", "failed")
            or obj.message_status in ("sent", "failed")
        )
