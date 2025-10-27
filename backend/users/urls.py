from django.urls import path
from .views import RegisterView, TelegramUserCreateView, TrainingChannelCreateView, TrainingChannelListView, TrainingChannelDeleteView, TrainingChannelToggleActiveView, ProcessedUsersListView, ProcessedUsersStatsView, ProcessedUsersTimeSeriesView, ProcessedUsersTopAccountsView, ProcessedUsersTopSourcesView
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
    path('channels/list/', TrainingChannelListView.as_view(), name='list-channels'),
    path('channels/<int:id>/toggle/', TrainingChannelToggleActiveView.as_view(), name='toggle-channel'),
    path('channels/<int:id>/delete/', TrainingChannelDeleteView.as_view(), name='delete-channel'),
    path('processed-users/', ProcessedUsersListView.as_view(), name='processed-users'),
    path('processed-users/stats/', ProcessedUsersStatsView.as_view(), name='processed-users-stats'),
    path('processed-users/stats/timeseries/', ProcessedUsersTimeSeriesView.as_view(), name='processed-users-timeseries'),
    path('processed-users/stats/top-sources/', ProcessedUsersTopSourcesView.as_view(), name='processed-users-top-sources'),
    path('processed-users/stats/top-accounts/', ProcessedUsersTopAccountsView.as_view(), name='processed-users-top-accounts'),
]
