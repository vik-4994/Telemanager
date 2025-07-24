from django.db import models
from django.contrib.auth.models import User

class Proxy(models.Model):
    PROXY_TYPES = [
        ('http', 'HTTP'),
        ('https', 'HTTPS'),
        ('socks5', 'SOCKS5'),
    ]

    host = models.CharField(max_length=100)
    port = models.IntegerField()
    proxy_type = models.CharField(max_length=10, choices=PROXY_TYPES, default='http')
    username = models.CharField(max_length=100, blank=True, null=True)
    password = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"{self.proxy_type.upper()} {self.host}:{self.port}"

class TelegramAccount(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='telegram_accounts')
    phone = models.CharField(max_length=20, unique=True)
    geo = models.CharField(max_length=10, blank=True, null=True)
    status = models.CharField(max_length=50, default="???")
    days_idle = models.CharField(max_length=50, blank=True, null=True)
    role = models.CharField(max_length=50, blank=True, null=True)
    name = models.CharField(max_length=100, blank=True, null=True)
    last_used = models.DateTimeField(auto_now=True)
    session_file = models.CharField(max_length=200, blank=True, null=True)

    proxy = models.ForeignKey(
        Proxy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accounts'
    )

    api_id = models.CharField(max_length=32, blank=True, null=True)
    api_hash = models.CharField(max_length=128, blank=True, null=True)
    twofa_password = models.CharField(max_length=128, blank=True, null=True) 

    is_training = models.BooleanField(default=False)
    training_status = models.CharField(max_length=255, blank=True, null=True)
    invite_task_id = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.phone} ({self.name})"


class IntermediateChannel(models.Model):
    username = models.CharField(max_length=100, unique=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    added_accounts = models.ManyToManyField(
        'accounts.TelegramAccount',
        blank=True,
        related_name='intermediate_channels'
    )

    def __str__(self):
        return self.username
