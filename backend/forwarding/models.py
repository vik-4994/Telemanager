from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class ForwardingGroup(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forwarding_groups')
    username = models.CharField(max_length=255, help_text="Username или ID группы", unique=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.username


class ForwardingTask(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forwarding_tasks')
    account = models.ForeignKey(TelegramAccount, on_delete=models.CASCADE, related_name='forwarding_tasks')
    source_channel = models.CharField(max_length=255, help_text="username или ID исходного канала")
    target_groups = models.ManyToManyField(ForwardingGroup)
    interval_minutes = models.PositiveIntegerField(default=60)
    is_active = models.BooleanField(default=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Задача {self.source_channel} → {self.account.phone}"
