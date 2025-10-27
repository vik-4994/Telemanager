from django.urls import path
from .views import TelegramAccountListView, UploadTelegramAccountView, ProxyListCreateView, set_account_proxy, delete_account, ProxyDestroyView, check_all_accounts_view, train_account_view, add_intermediate_channel, list_intermediate_channels, delete_intermediate_channel, add_account_to_intermediate_channel, invite_all_users_view, stop_invite_task, send_code_view, sign_in_view, send_direct_messages_view, TelegramProfileView, TelegramProfilePhotoView

urlpatterns = [
    path('', TelegramAccountListView.as_view(), name='telegram_accounts'),
    path('upload/', UploadTelegramAccountView.as_view(), name='upload_account'),
    path('proxies/', ProxyListCreateView.as_view(), name='proxy-list-create'),
    path('<int:account_id>/set_proxy/', set_account_proxy),
    path('<int:account_id>/', delete_account, name='delete_account'),
    path('proxies/<int:pk>/', ProxyDestroyView.as_view(), name='proxy-delete'),
    path('check_all/', check_all_accounts_view, name='check-all-accounts'),
    path('<int:account_id>/train/', train_account_view, name='train-account'),
    path('intermediate-channels/', list_intermediate_channels, name='list_channels'),
    path('intermediate-channels/add/', add_intermediate_channel, name='add_channel'),
    path('intermediate-channels/<int:pk>/', delete_intermediate_channel, name='delete-intermediate-channel'),
    path('intermediate-channels/<int:pk>/add_account/', add_account_to_intermediate_channel, name='add-account-to-ichannel'),
    path("invite/", invite_all_users_view, name='invite-to-channel'),
    path("invite/stop/", stop_invite_task, name="stop-invite-task"),
    path("send_code/", send_code_view, name="send_code"),
    path("sign_in/", sign_in_view, name="sign_in"),
    path("broadcast/", send_direct_messages_view, name="broadcast"),
    path('<int:account_id>/profile/', TelegramProfileView.as_view(), name='tg-profile'),
    path('<int:account_id>/profile/photo/', TelegramProfilePhotoView.as_view(), name='tg-photo'),
]
