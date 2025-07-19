from django.db import models
from django.contrib.auth.models import User

class Proxy(models.Model):
    host = models.CharField(max_length=100)
    port = models.IntegerField()
    username = models.CharField(max_length=100, blank=True, null=True)
    password = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"{self.host}:{self.port}"

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

    def __str__(self):
        return f"{self.phone} ({self.name})"
