from rest_framework import serializers
from .models import ForwardingGroup, ForwardingTask

class ForwardingGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = ForwardingGroup
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'user']


class ForwardingTaskSerializer(serializers.ModelSerializer):
    target_groups = serializers.PrimaryKeyRelatedField(
        queryset=ForwardingGroup.objects.all(),
        many=True
    )

    class Meta:
        model = ForwardingTask
        fields = '__all__'
        read_only_fields = ['id', 'user', 'created_at', 'last_sent_at']
