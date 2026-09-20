#!/bin/sh
# Daily database backup. Cron example (server): 0 2 * * * cd /opt/bloom && ./deploy/backup.sh
# Copy the files off this server too (e.g. to cloud storage); a backup on the same disk is not enough.
set -e
mkdir -p backups
docker compose exec -T db pg_dump -U bloom bloom | gzip > "backups/bloom-$(date +%F).sql.gz"
find backups -name 'bloom-*.sql.gz' -mtime +30 -delete
