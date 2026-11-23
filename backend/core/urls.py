from django.contrib import admin
from django.urls import path, include

from core.auth_views import LoginView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", LoginView.as_view()),
    path("api/", include("fleet.urls")),
]
