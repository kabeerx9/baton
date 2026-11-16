#!/bin/sh
# Restore a Baton dump into an existing, empty database.
#
#   restore.sh latest [target-db]        newest object under BACKUP_PREFIX
#   restore.sh s3://bucket/key.dump [target-db]
#   restore.sh /path/to/file.dump [target-db]
#
# target-db names a database on the same server the backup container already
# talks to (PGHOST/PGUSER/PGPASSWORD), so no password is typed on the command
# line. It is required unless RESTORE_DATABASE_URL points somewhere else, which
# also covers restoring into a different server.
#
# It never defaults to the live database: name the scratch database yourself.
set -eu

usage() {
  echo "usage: restore.sh <latest | s3://bucket/key | /path/to.dump> [target-db]" >&2
  exit 2
}

source="${1:-}"
target_db="${2:-}"
[ -n "$source" ] || usage

if [ -n "${RESTORE_DATABASE_URL:-}" ]; then
  target="$RESTORE_DATABASE_URL"
elif [ -n "$target_db" ]; then
  target="$target_db"
else
  echo "restore: name a target database (or set RESTORE_DATABASE_URL)" >&2
  usage
fi

prefix="${BACKUP_PREFIX:-baton/postgres}"
prefix="${prefix%/}"
region="${BACKUP_S3_REGION:-us-east-1}"

s3() {
  if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
    aws --endpoint-url "$BACKUP_S3_ENDPOINT" --region "$region" "$@"
  else
    aws --region "$region" "$@"
  fi
}

dump=""
case "$source" in
  latest)
    : "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required for latest}"
    key="$(s3 s3api list-objects-v2 --bucket "$BACKUP_S3_BUCKET" \
      --prefix "$prefix/" --query 'sort_by(Contents,&LastModified)[-1].Key' \
      --output text)"
    if [ -z "$key" ] || [ "$key" = "None" ]; then
      echo "restore: no dumps found under s3://$BACKUP_S3_BUCKET/$prefix/" >&2
      exit 1
    fi
    dump="${TMPDIR:-/tmp}/restore.dump"
    echo "restore: downloading s3://$BACKUP_S3_BUCKET/$key"
    s3 s3 cp "s3://$BACKUP_S3_BUCKET/$key" "$dump" --only-show-errors
    ;;
  s3://*)
    dump="${TMPDIR:-/tmp}/restore.dump"
    echo "restore: downloading $source"
    s3 s3 cp "$source" "$dump" --only-show-errors
    ;;
  *)
    if [ ! -f "$source" ]; then
      echo "restore: no such file: $source" >&2
      exit 1
    fi
    dump="$source"
    ;;
esac

echo "restore: restoring into database $target"
pg_restore --dbname "$target" --clean --if-exists --no-owner --no-privileges \
  --exit-on-error "$dump"
echo "restore: ok"
