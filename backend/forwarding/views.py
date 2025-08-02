from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ForwardingGroup, ForwardingTask
from .serializers import ForwardingGroupSerializer, ForwardingTaskSerializer


class ForwardingGroupViewSet(viewsets.ModelViewSet):
    queryset = ForwardingGroup.objects.all()
    serializer_class = ForwardingGroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Только свои группы
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def disable(self, request, pk=None):
        group = self.get_object()
        group.is_active = False
        group.save()
        return Response({'status': 'disabled'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def enable(self, request, pk=None):
        group = self.get_object()
        group.is_active = True
        group.save()
        return Response({'status': 'enabled'}, status=status.HTTP_200_OK)


class ForwardingTaskViewSet(viewsets.ModelViewSet):
    queryset = ForwardingTask.objects.all()
    serializer_class = ForwardingTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Только свои задачи
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
