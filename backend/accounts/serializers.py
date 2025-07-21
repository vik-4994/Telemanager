from rest_framework import serializers
from .models import TelegramAccount
from .models import Proxy

class TelegramAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelegramAccount
        fields = [
            'id', 'phone', 'geo', 'status', 'days_idle', 'role',
            'name', 'last_used', 'proxy_id',
            'api_id', 'api_hash', 'twofa_password'
        ]

class ProxySerializer(serializers.ModelSerializer):
    class Meta:
        model = Proxy
        fields = ['id', 'host', 'port', 'proxy_type', 'username', 'password']