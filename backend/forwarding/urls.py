from django.urls import path
from . import views

urlpatterns = [
    path('groups/', views.ForwardingGroupListCreateView.as_view(), name='group-list-create'),
    path('groups/<int:pk>/', views.ForwardingGroupRetrieveUpdateDestroyView.as_view(), name='group-detail'),
    path('groups/<int:pk>/disable/', views.disable_group, name='group-disable'),
    path('groups/<int:pk>/enable/', views.enable_group, name='group-enable'),

    path('tasks/', views.ForwardingTaskListCreateView.as_view(), name='task-list-create'),
    path('tasks/<int:pk>/', views.ForwardingTaskRetrieveUpdateDestroyView.as_view(), name='task-detail'),
]
