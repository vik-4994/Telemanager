from django.urls import path
from .views import TelegramAccountListView, UploadTelegramAccountView, ProxyListCreateView

urlpatterns = [
    path('', TelegramAccountListView.as_view(), name='telegram_accounts'),
    path('upload/', UploadTelegramAccountView.as_view(), name='upload_account'),
    path('proxies/', ProxyListCreateView.as_view(), name='proxy-list-create'),
]
