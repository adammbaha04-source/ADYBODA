"""Rudisha data kutoka nakala (backup) iliyopo Cloudflare R2.

Matumizi:
  python manage.py restore_from_r2 --list
  python manage.py restore_from_r2                (nakala ya mwisho)
  python manage.py restore_from_r2 --key backups/adybajaj_2026-11-08_123456.json.gz
  python manage.py restore_from_r2 --flush        (futa data ya sasa kwanza)

Env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
"""
import gzip
import os
import tempfile

import boto3
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Rudisha data kutoka backup ya Cloudflare R2"

    def add_arguments(self, parser):
        parser.add_argument("--key", default="latest", help="Jina la nakala, au 'latest' (chaguo-msingi)")
        parser.add_argument("--list", action="store_true", help="Onyesha nakala zilizopo tu")
        parser.add_argument("--flush", action="store_true", help="Futa data ya sasa kabla ya kurudisha")

    def handle(self, *args, **options):
        needed = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]
        missing = [k for k in needed if not os.environ.get(k)]
        if missing:
            raise CommandError("Hazipo env vars: " + ", ".join(missing))

        client = boto3.client(
            "s3",
            endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
        )
        bucket = os.environ["R2_BUCKET"]

        resp = client.list_objects_v2(Bucket=bucket, Prefix="backups/")
        keys = sorted(o["Key"] for o in resp.get("Contents", []))

        if options["list"]:
            for k in keys:
                self.stdout.write(k)
            self.stdout.write(f"Jumla: {len(keys)}")
            return

        if not keys:
            raise CommandError("Hakuna nakala kwenye R2.")

        key = keys[-1] if options["key"] == "latest" else options["key"]
        if key not in keys:
            raise CommandError(f"Nakala haijapatikana: {key}")

        self.stdout.write(f"Narudisha kutoka: {key}")
        body = client.get_object(Bucket=bucket, Key=key)["Body"].read()
        text = gzip.decompress(body)

        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            tmp.write(text)
            path = tmp.name

        try:
            if options["flush"]:
                call_command("flush", "--no-input")
            call_command("loaddata", path)
        finally:
            os.remove(path)

        self.stdout.write(self.style.SUCCESS("Data imerudishwa vizuri."))
