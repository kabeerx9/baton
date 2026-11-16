#!/bin/sh
# One pg_dump in custom format, uploaded to S3-compatible storage, then prune
# dumps older than the retention window.
#
# Nothing here holds a secret: every value comes from the environment that
# deploy/compose.prod.yml passes from deploy/.env.production.
set -eu

: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"

prefix="${BACKUP_PREFIX:-baton/postgres}"
prefix="${prefix%/}"
region="${BACKUP_S3_REGION:-us-east-1}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"

case "$retention_days" in
  '' | *[!0-9]*)
    echo "backup: BACKUP_RETENTION_DAYS must be a whole number of days" >&2
    exit 1
    ;;
esac

# aws-cli v1 in this image supports an S3-compatible endpoint through the flag.
s3() {
  if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
    aws --endpoint-url "$BACKUP_S3_ENDPOINT" --region "$region" "$@"
  else
    aws --region "$region" "$@"
  fi
}

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="${TMPDIR:-/tmp}/baton-$stamp.dump"
trap 'rm -f "$dump"' EXIT HUP INT TERM

echo "backup: dumping database"
started="$(date -u +%s)"
if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --format=custom --file="$dump" "$DATABASE_URL"
else
  # Falls back to the PG* variables set by compose.
  pg_dump --format=custom --file="$dump"
fi

bytes="$(wc -c <"$dump" | tr -d ' ')"
key="$prefix/$stamp.dump"
echo "backup: uploading s3://$BACKUP_S3_BUCKET/$key ($bytes bytes)"
s3 s3 cp "$dump" "s3://$BACKUP_S3_BUCKET/$key" --only-show-errors
echo "backup: uploaded in $(( $(date -u +%s) - started ))s"

if [ "$retention_days" -gt 0 ]; then
  # ISO 8601 timestamps sort by time as plain strings, which is all this needs.
  cutoff="$(date -u -d "@$(( $(date -u +%s) - retention_days * 86400 ))" +%Y-%m-%dT%H:%M:%S)"
  s3 s3api list-objects-v2 --bucket "$BACKUP_S3_BUCKET" --prefix "$prefix/" \
    --query 'Contents[].[Key,LastModified]' --output text 2>/dev/null |
    awk -v cutoff="$cutoff" '$2 < cutoff { print $1 }' |
    while read -r expired; do
      [ -n "$expired" ] || continue
      s3 s3api delete-object --bucket "$BACKUP_S3_BUCKET" --key "$expired" >/dev/null
      echo "backup: removed expired s3://$BACKUP_S3_BUCKET/$expired"
    done
fi

echo "backup: ok"
