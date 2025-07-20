from django.urls import path
from .views import RegisterView, TelegramUserCreateView, TrainingChannelCreateView
from .views import MeView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('add-user/', TelegramUserCreateView.as_view(), name='add-user'),
    path('add-channel/', TrainingChannelCreateView.as_view(), name='add-channel'),
]
