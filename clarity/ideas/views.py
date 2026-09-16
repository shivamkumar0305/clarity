from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Idea
from .serializers import IdeaSerializer, IdeaCreateSerializer
from .services import generate_roadmap


class IdeaCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        in_serializer = IdeaCreateSerializer(data=request.data)
        in_serializer.is_valid(raise_exception=True)
        input_text = in_serializer.validated_data["input_text"]

        idea = Idea.objects.create(
            user=request.user,
            input_text=input_text,
            status="pending",
        )

        try:
            result = generate_roadmap(input_text)
            idea.idea_title = result.get("idea_title", "")
            idea.phases = result.get("phases", [])
            idea.status = "done"
            idea.save()
        except Exception as e:
            idea.status = "failed"
            idea.error_message = str(e)
            idea.save()
            return Response(IdeaSerializer(idea).data, status=status.HTTP_502_BAD_GATEWAY)

        return Response(IdeaSerializer(idea).data, status=status.HTTP_201_CREATED)


class IdeaListView(generics.ListAPIView):
    serializer_class = IdeaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Idea.objects.filter(user=self.request.user)


class IdeaDetailView(generics.RetrieveAPIView):
    serializer_class = IdeaSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Idea.objects.all()

    def get_queryset(self):
        return Idea.objects.filter(user=self.request.user)