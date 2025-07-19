from rest_framework import serializers
from .models import TelegramAccount
from .models import Proxy

class TelegramAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelegramAccount
        fields = [
            'id', 'phone', 'geo', 'status', 'days_idle',
            'role', 'name', 'last_used'
        ]

class ProxySerializer(serializers.ModelSerializer):
    class Meta:
        model = Proxy
        fields = ['id', 'host', 'port', 'username', 'password']