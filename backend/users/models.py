from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class TelegramUser(models.Model):
    user_id = models.BigIntegerField(unique=True)
    username = models.CharField(max_length=150, blank=True, null=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    source_channel = models.CharField(max_length=255, blank=True, null=True)

    invite_status = models.CharField(
        max_length=20,
        choices=[('pending','Pending'),('success','Success'),('failed','Failed')],
        default='pending'
    )
    message_status = models.CharField(
        max_length=20,
        choices=[('pending','Pending'),('sent','Sent'),('failed','Failed')],
        default='pending'
    )

    # NEW: временные метки
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    invite_changed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    message_changed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True, db_index=True)

    # NEW: коды ошибок (по желанию)
    invite_error_code = models.CharField(max_length=64, blank=True, null=True)
    message_error_code = models.CharField(max_length=64, blank=True, null=True)

    # NEW: кто обрабатывал (по желанию; закомментируй если ещё нет модели)
    processed_by = models.ForeignKey(
        'accounts.TelegramAccount',
        on_delete=models.SET_NULL,
        null=True, blank=True, related_name='processed_users'
    )

    owner = models.ForeignKey(User, on_delete=models.CASCADE,
                              related_name="telegram_users", null=True, blank=True)

    def __str__(self):
        return self.username or str(self.user_id)

    @property
    def processed(self) -> bool:
        return (
            self.invite_status in ('success','failed')
            or self.message_status in ('sent','failed')
        )

    def save(self, *args, **kwargs):
        now = timezone.now()
        old = None
        if self.pk:
            try:
                old = TelegramUser.objects.only(
                    'invite_status','message_status',
                    'invite_changed_at','message_changed_at','processed_at'
                ).get(pk=self.pk)
            except TelegramUser.DoesNotExist:
                old = None

        if old:
            if self.invite_status != old.invite_status:
                self.invite_changed_at = now
            if self.message_status != old.message_status:
                self.message_changed_at = now
        else:
            if self.invite_status != 'pending' and not self.invite_changed_at:
                self.invite_changed_at = now
            if self.message_status != 'pending' and not self.message_changed_at:
                self.message_changed_at = now

        if self.processed and not self.processed_at:
            self.processed_at = now

        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-id']
        indexes = [
            models.Index(fields=['owner','invite_status']),
            models.Index(fields=['owner','message_status']),
            models.Index(fields=['owner','source_channel']),
            models.Index(fields=['owner','processed_at']),
            models.Index(fields=['created_at']),
        ]


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
