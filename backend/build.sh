#!/usr/bin/env bash
set -o errexit
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input
if [ -n "$RESTORE_KEY" ]; then
  python manage.py restore_from_r2 --key "$RESTORE_KEY"
else
  python manage.py backup_to_r2 || echo "Backup imeshindwa, deploy inaendelea"
fi
python manage.py create_owner
