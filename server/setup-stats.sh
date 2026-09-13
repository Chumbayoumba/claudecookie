#!/usr/bin/env bash
#
# Installs the ingest service and the Telegram bot on the server. Run as root:
#
#   ssh root@<host> 'bash /tmp/cc-deploy/setup-stats.sh'
#
# Idempotent. It requires /etc/claudecookie/bot.conf to already exist (uploaded
# by deploy/deploy-stats.sh from your machine, so the bot token never has to be
# typed on the server). Without it, the services are not started.

set -euo pipefail

APP_DIR=/opt/claudecookie
DATA_DIR=/var/lib/claudecookie
CONF_DIR=/etc/claudecookie
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "This script must run as root." >&2
  exit 1
fi

echo "==> Service user"
if ! id -u ccstats >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin ccstats
fi

echo "==> Directories"
install -d -o root   -g root    -m 0755 "$APP_DIR"
install -d -o ccstats -g ccstats -m 0750 "$DATA_DIR"
install -d -o root   -g ccstats -m 0750 "$CONF_DIR"

echo "==> Python dependencies"
if ! python3 -c 'import cryptography' >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y -qq python3-cryptography
  else
    python3 -m pip install --disable-pip-version-check cryptography
  fi
fi
python3 -c 'import cryptography'
if ! python3 -c 'import curl_cffi' >/dev/null 2>&1; then
  if ! command -v pip3 >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    apt-get install -y -qq python3-pip
  fi
  python3 -m pip install --disable-pip-version-check --break-system-packages 'curl_cffi>=0.10.0'
fi
python3 -c 'import curl_cffi'

echo "==> Application code"
install -o root -g root -m 0644 "$SCRIPT_DIR/stats_service.py" "$APP_DIR/stats_service.py"
install -o root -g root -m 0644 "$SCRIPT_DIR/claude_check.py"  "$APP_DIR/claude_check.py"
install -o root -g root -m 0644 "$SCRIPT_DIR/box.py"           "$APP_DIR/box.py"
install -o root -g root -m 0644 "$SCRIPT_DIR/tgbot.py"         "$APP_DIR/tgbot.py"

echo "==> Config"
if [[ ! -f "$CONF_DIR/bot.conf" ]]; then
  echo "ERROR: $CONF_DIR/bot.conf is missing. Run deploy/deploy-stats.sh first." >&2
  exit 1
fi
chown root:ccstats "$CONF_DIR/bot.conf"
chmod 0640 "$CONF_DIR/bot.conf"

if [[ ! -f "$CONF_DIR/box.key" ]]; then
  echo "==> Box key"
  PYTHONPATH="$SCRIPT_DIR" python3 - <<'PY'
from pathlib import Path
from box import write_new_key
write_new_key(Path("/etc/claudecookie/box.key"))
PY
fi
chown root:ccstats "$CONF_DIR/box.key"
chmod 0640 "$CONF_DIR/box.key"

echo "==> systemd units"
install -o root -g root -m 0644 "$SCRIPT_DIR/claudecookie-ingest.service" /etc/systemd/system/claudecookie-ingest.service
install -o root -g root -m 0644 "$SCRIPT_DIR/claudecookie-bot.service"    /etc/systemd/system/claudecookie-bot.service
systemctl daemon-reload
systemctl enable claudecookie-ingest claudecookie-bot
systemctl restart claudecookie-ingest
systemctl restart claudecookie-bot

sleep 1
echo "==> Health"
if curl -fsS --max-time 5 http://127.0.0.1:8787/api/health >/dev/null; then
  echo "    ingest up on 127.0.0.1:8787"
else
  echo "    WARNING: ingest health failed — journalctl -u claudecookie-ingest -n 30" >&2
fi
systemctl is-active claudecookie-bot >/dev/null && echo "    bot active" || \
  echo "    WARNING: bot not active — journalctl -u claudecookie-bot -n 30" >&2
