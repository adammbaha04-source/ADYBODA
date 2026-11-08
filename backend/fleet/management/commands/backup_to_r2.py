"""Backup ya database kwenda Cloudflare R2.

Matumizi:  python manage.py backup_to_r2

Environment variables zinazohitajika (kwenye Render):
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
"""
import gzip
import io
import os
from datetime import datetime, timezone

import boto3
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

KEEP_LAST = 30  # hifadhi backup 30 za mwisho tu


class Command(BaseCommand):
    help = "Hifadhi nakala ya data (JSON, gzip) kwenye Cloudflare R2"

    def handle(self, *args, **options):
        needed = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]
        missing = [k for k in needed if not os.environ.get(k)]
        if missing:
            raise CommandError("Hazipo env vars: " + ", ".join(missing))

        buf = io.StringIO()
        call_command(
            "dumpdata",
            "--natural-foreign",
            "--natural-primary",
            "--exclude=contenttypes",
            "--exclude=auth.permission",
            "--exclude=sessions",
            "--exclude=admin.logentry",
            stdout=buf,
        )
        data = gzip.compress(buf.getvalue().encode("utf-8"))

        client = boto3.client(
            "s3",
            endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
        )
        bucket = os.environ["R2_BUCKET"]
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
        key = f"backups/adybajaj_{stamp}.json.gz"
        client.put_object(Bucket=bucket, Key=key, Body=data)
        self.stdout.write(self.style.SUCCESS(f"Backup imehifadhiwa: {key} ({len(data)} bytes)"))

        # futa backup za zamani, bakiza KEEP_LAST za mwisho
        resp = client.list_objects_v2(Bucket=bucket, Prefix="backups/")
        keys = sorted(o["Key"] for o in resp.get("Contents", []))
        for old in keys[:-KEEP_LAST]:
            client.delete_object(Bucket=bucket, Key=old)
