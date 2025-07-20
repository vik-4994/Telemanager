from django.urls import path
from .views import TelegramAccountListView, UploadTelegramAccountView, ProxyListCreateView, set_account_proxy, delete_account

urlpatterns = [
    path('', TelegramAccountListView.as_view(), name='telegram_accounts'),
    path('upload/', UploadTelegramAccountView.as_view(), name='upload_account'),
    path('proxies/', ProxyListCreateView.as_view(), name='proxy-list-create'),
    path('<int:account_id>/set_proxy/', set_account_proxy),
    path('<int:account_id>/', delete_account, name='delete_account'),
]
