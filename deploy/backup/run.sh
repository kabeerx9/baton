#!/bin/sh
# Nightly loop for the backup sidecar. Waits for BACKUP_SCHEDULE_UTC, runs one
# backup, repeats. The container stays up so `docker compose up -d` never has to
# schedule anything on the host.
set -eu

: "${BACKUP_SCHEDULE_UTC:=03:15}"

hour="${BACKUP_SCHEDULE_UTC%%:*}"
minute="${BACKUP_SCHEDULE_UTC##*:}"
case "$BACKUP_SCHEDULE_UTC" in
  *[!0-9:]* | :* | *: | *:*:*)
    echo "run: BACKUP_SCHEDULE_UTC must be HH:MM in UTC" >&2
    exit 1
    ;;
esac

next_run() {
  now="$(date -u +%s)"
  candidate="$(date -u -d "$(date -u +%Y-%m-%d) $hour:$minute:00" +%s)"
  if [ "$candidate" -le "$now" ]; then
    tomorrow="$(date -u -d "@$((now + 86400))" +%Y-%m-%d)"
    candidate="$(date -u -d "$tomorrow $hour:$minute:00" +%s)"
  fi
  echo "$candidate"
}

if [ "${BACKUP_ON_START:-false}" = "true" ]; then
  echo "run: BACKUP_ON_START is set, taking a backup now"
  /usr/local/bin/backup.sh || echo "run: backup failed, continuing" >&2
fi

while :; do
  target="$(next_run)"
  echo "run: next backup at $(date -u -d "@$target" +%Y-%m-%dT%H:%M:%SZ)"
  while :; do
    now="$(date -u +%s)"
    [ "$now" -ge "$target" ] && break
    remaining=$((target - now))
    # Short sleeps keep `docker compose stop` responsive and survive clock jumps.
    [ "$remaining" -gt 300 ] && remaining=300
    sleep "$remaining"
  done

  if /usr/local/bin/backup.sh; then
    echo "run: backup finished"
  else
    echo "run: backup failed, retrying in one hour" >&2
    sleep 3600
  fi
done
