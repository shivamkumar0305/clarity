from rest_framework import serializers
from .models import Idea


class IdeaCreateSerializer(serializers.Serializer):
    input_text = serializers.CharField(max_length=2000)


class IdeaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Idea
        fields = ["id", "input_text", "phases", "status", "error_message", "created_at"]
        read_only_fields = fields