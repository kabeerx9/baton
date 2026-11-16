# Backup sidecar for Baton: pg_dump (custom format) -> S3-compatible storage.
# Built rather than pulled so the client tools always match the Postgres major
# version and no shell is missing at run time.
FROM alpine:3.22

RUN apk add --no-cache \
    postgresql16-client \
    aws-cli \
    ca-certificates \
    tzdata \
  && addgroup -g 1001 backup \
  && adduser -u 1001 -G backup -D backup

# Path-style addressing works on every S3-compatible provider (AWS, R2,
# Spaces, B2, MinIO); virtual-host style does not work with IP endpoints.
RUN mkdir -p /etc/aws && printf '[default]\ns3 =\n  addressing_style = path\n' > /etc/aws/config

COPY backup.sh restore.sh run.sh /usr/local/bin/
RUN chmod 0755 /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/run.sh

ENV AWS_CONFIG_FILE=/etc/aws/config \
    AWS_PAGER=""

USER 1001

# Long-running nightly loop. For a one-off run:
#   docker compose ... run --rm --entrypoint /usr/local/bin/backup.sh backup
ENTRYPOINT ["/usr/local/bin/run.sh"]
