from django.db import models
from django.contrib.auth.models import User

class TelegramUser(models.Model):
    user_id = models.BigIntegerField(unique=True)
    username = models.CharField(max_length=150, blank=True, null=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    source_channel = models.CharField(max_length=255, blank=True, null=True)

    invite_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('success', 'Success'),
            ('failed', 'Failed')
        ],
        default='pending'
    )

    message_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('sent', 'Sent'),
            ('failed', 'Failed')
        ],
        default='pending'
    )


    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="telegram_users",
        null=True,
        blank=True,
    )

    def __str__(self):
        return self.username or str(self.user_id)


class TrainingChannel(models.Model):
    CHANNEL_TYPE_CHOICES = [
        ('group', 'Group'),
        ('channel', 'Channel'),
    ]

    username = models.CharField(max_length=255, unique=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    type = models.CharField(max_length=10, choices=CHANNEL_TYPE_CHOICES)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.username
