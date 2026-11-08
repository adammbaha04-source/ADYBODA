#!/usr/bin/env bash
set -o errexit
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py backup_to_r2 || echo "Backup imeshindwa, deploy inaendelea"
python manage.py migrate --no-input
python manage.py create_owner
