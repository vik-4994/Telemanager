import os
from celery import Celery

# Указываем настройки Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'telemanager_django.settings')

app = Celery('telemanager_django')

# Читает конфигурацию из settings.py с префиксом CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')

# Автоматический импорт задач из всех приложений
app.autodiscover_tasks()

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
