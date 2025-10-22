from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import ForwardingGroup, ForwardingTask
from .serializers import ForwardingGroupSerializer, ForwardingTaskSerializer
from accounts.tasks import process_forwarding_task_by_id


class ForwardingGroupListCreateView(generics.ListCreateAPIView):
    queryset = ForwardingGroup.objects.all()
    serializer_class = ForwardingGroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ForwardingGroupRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ForwardingGroup.objects.all()
    serializer_class = ForwardingGroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def disable_group(request, pk):
    try:
        group = ForwardingGroup.objects.get(pk=pk, user=request.user)
        group.is_active = False
        group.save()
        return Response({'status': 'disabled'})
    except ForwardingGroup.DoesNotExist:
        return Response({'error': 'Group not found'}, status=404)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def enable_group(request, pk):
    try:
        group = ForwardingGroup.objects.get(pk=pk, user=request.user)
        group.is_active = True
        group.save()
        return Response({'status': 'enabled'})
    except ForwardingGroup.DoesNotExist:
        return Response({'error': 'Group not found'}, status=404)

class ForwardingTaskListCreateView(generics.ListCreateAPIView):
    queryset = ForwardingTask.objects.all()
    serializer_class = ForwardingTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        task = serializer.save(user=self.request.user)
        async_result = process_forwarding_task_by_id.delay(task.id)
        task.celery_task_id = async_result.id
        task.save()

class ForwardingTaskRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ForwardingTask.objects.all()
    serializer_class = ForwardingTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)


from celery import current_app
revoke = current_app.control.revoke

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def stop_forwarding_task(request, pk):
    try:
        task = ForwardingTask.objects.get(pk=pk, user=request.user)
        if not task.celery_task_id:
            return Response({"error": "Задача не запущена или ID отсутствует"}, status=400)

        revoke(task.celery_task_id, terminate=True)
        task.is_active = False
        task.celery_task_id = None
        task.save()

        return Response({"message": "Задача остановлена"})
    except ForwardingTask.DoesNotExist:
        return Response({"error": "Задача не найдена"}, status=404)
