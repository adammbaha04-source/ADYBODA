"""Create the first owner account from environment variables.

Set OWNER_USERNAME and OWNER_PASSWORD in Render (Environment tab).
Runs on every deploy from build.sh. If the user already exists, it does nothing.
"""
import os
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create the owner account from OWNER_USERNAME and OWNER_PASSWORD (skips if it exists)."

    def handle(self, *args, **options):
        username = os.environ.get("OWNER_USERNAME", "").strip()
        password = os.environ.get("OWNER_PASSWORD", "")
        if not username or not password:
            self.stdout.write("OWNER_USERNAME or OWNER_PASSWORD not set. Skipping.")
            return
        User = get_user_model()
        if User.objects.filter(username=username).exists():
            self.stdout.write("Owner already exists. Skipping.")
            return
        User.objects.create_superuser(username=username, email="", password=password)
        self.stdout.write(self.style.SUCCESS(f"Owner '{username}' created."))
