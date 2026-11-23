import os

from django.contrib import admin
from django.urls import path, include

from core.auth_views import LoginView
from fleet.views import LogoutView

# Weka DJANGO_ADMIN_PATH kwenye Render kuwa neno gumu (mfano "ops-7f3k2q9x/").
# Ikiachwa tupu, inatumia "admin/".
ADMIN_PATH = os.environ.get("DJANGO_ADMIN_PATH", "admin").strip("/") + "/"

urlpatterns = [
    path(ADMIN_PATH, admin.site.urls),
    path("api/auth/token/", LoginView.as_view()),
    path("api/auth/logout/", LogoutView.as_view()),
    path("api/", include("fleet.urls")),
]
