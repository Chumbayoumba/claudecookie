#!/usr/bin/env bash
#
# Fetches the current DB-IP Lite country database.
#
# DB-IP Lite is CC BY 4.0 and needs no account or licence key, unlike MaxMind's
# GeoLite2. Attribution is rendered in the site footer, which is what the licence
# requires.
#
# Installed as /usr/local/bin/claudecookie-geoip-update and run monthly by cron.

set -euo pipefail

DEST="/var/lib/geoip/dbip-country-lite.mmdb"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$(dirname "$DEST")"

download() {
  local edition="$1"
  local url="https://download.db-ip.com/free/dbip-country-lite-${edition}.mmdb.gz"
  echo "    trying $edition"
  curl -fsS --max-time 120 -o "$TMP/db.mmdb.gz" "$url"
}

echo "==> Updating the GeoIP country database"

# A new edition appears at the start of each month, but not always on the 1st,
# so fall back to last month rather than failing the cron run.
if ! download "$(date -u +%Y-%m)"; then
  if ! download "$(date -u -d '1 month ago' +%Y-%m)"; then
    echo "    could not download either edition; keeping the existing database" >&2
    exit 0
  fi
fi

gunzip -f "$TMP/db.mmdb.gz"

# Guard against a truncated or HTML error-page download replacing a good file.
if [[ ! -s "$TMP/db.mmdb" ]] || [[ "$(stat -c%s "$TMP/db.mmdb")" -lt 1000000 ]]; then
  echo "    downloaded file looks wrong; keeping the existing database" >&2
  exit 0
fi

install -m 0644 "$TMP/db.mmdb" "$DEST"
echo "    installed $(stat -c%s "$DEST") bytes to $DEST"

# `auto_reload 24h` in the geoip2 block picks the new file up on its own, but a
# reload makes it immediate and costs nothing.
#
# setup-server.sh sets CC_SKIP_RELOAD while it is still assembling the config:
# at that point the map that defines $country_code has not been appended yet, so
# a reload would fail noisily for no reason.
if [[ -z "${CC_SKIP_RELOAD:-}" ]] && systemctl is-active --quiet nginx; then
  nginx -t && systemctl reload nginx
fi
