#!/usr/bin/env bash
#
# Provisions the stats backend: writes /etc/claudecookie/bot.conf on the server
# from local secrets, uploads server/, and installs the ingest + bot services.
#
#   ./deploy/deploy-stats.sh
#
# The bot token and owner id come from .env (gitignored) so no secret is typed
# on the server or committed. Re-running keeps the existing ingest_salt (so the
# visitor hashes stay stable) unless bot.conf is absent.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[[ -f .env ]] || { echo "No .env — copy .env.example first." >&2; exit 1; }
# shellcheck disable=SC1091
set -a; source .env; set +a
: "${DEPLOY_HOST:?set DEPLOY_HOST in .env}"
: "${TG_BOT_TOKEN:?set TG_BOT_TOKEN in .env}"
: "${TG_OWNER_ID:?set TG_OWNER_ID in .env}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"

SSH_OPTS=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && SSH_OPTS+=(-i "${DEPLOY_SSH_KEY/#\~/$HOME}")
SSH=(ssh "${SSH_OPTS[@]}" "root@$DEPLOY_HOST")

echo "==> Uploading server/"
"${SSH[@]}" 'mkdir -p /tmp/cc-deploy'
rsync -az -e "ssh ${SSH_OPTS[*]}" server/ "root@$DEPLOY_HOST:/tmp/cc-deploy/"

echo "==> Writing bot.conf (token stays out of the repo and off the shell history)"
# Reuse an existing ingest_salt if one is already on the server; otherwise mint one.
EXISTING_SALT=$("${SSH[@]}" 'python3 - <<PY 2>/dev/null || true
import json,sys
try: print(json.load(open("/etc/claudecookie/bot.conf")).get("ingest_salt",""))
except Exception: pass
PY')
EXISTING_PROXY=$("${SSH[@]}" 'python3 - <<PY 2>/dev/null || true
import json
try:
    data = json.load(open("/etc/claudecookie/bot.conf"))
    print(data.get("check_proxy") or data.get("CC_CHECK_PROXY") or "")
except Exception:
    pass
PY')
SALT="${EXISTING_SALT:-$(python3 -c 'import secrets;print(secrets.token_hex(16))')}"
PROXY="${CC_CHECK_PROXY:-$EXISTING_PROXY}"

CONF=$(TG_BOT_TOKEN="$TG_BOT_TOKEN" TG_OWNER_ID="$TG_OWNER_ID" SALT="$SALT" PROXY="$PROXY" python3 - <<'PY'
import json, os
payload = {
    "bot_token": os.environ["TG_BOT_TOKEN"],
    "owner_id": int(os.environ["TG_OWNER_ID"]),
    "ingest_salt": os.environ["SALT"],
}
proxy = os.environ.get("PROXY") or ""
if proxy.strip():
    payload["check_proxy"] = proxy.strip()
print(json.dumps(payload))
PY
)
echo "$CONF" | "${SSH[@]}" 'install -d -m 0750 /etc/claudecookie && cat > /etc/claudecookie/bot.conf && chmod 0640 /etc/claudecookie/bot.conf'

echo "==> Installing services"
"${SSH[@]}" 'bash /tmp/cc-deploy/setup-stats.sh'

echo
echo "==> Done. Send the bot /start in Telegram."
