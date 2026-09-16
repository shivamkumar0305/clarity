from django.urls import path
from .views import IdeaCreateView, IdeaListView, IdeaDetailView

urlpatterns = [
    path("ideas/", IdeaCreateView.as_view(), name="idea-create"),
    path("ideas/list/", IdeaListView.as_view(), name="idea-list"),
    path("ideas/<int:pk>/", IdeaDetailView.as_view(), name="idea-detail"),
]