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
# Tolerate a Windows/CRLF .env: strip trailing \r so values don't carry a stray
# carriage return into ssh options or bot.conf.
set -a; source <(sed 's/\r$//' .env); set +a
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
# Pull the whole existing conf so a redeploy keeps ingest_salt and any check
# settings already on the server; local .env values override per key.
EXISTING_CONF=$("${SSH[@]}" 'cat /etc/claudecookie/bot.conf 2>/dev/null || true')

CONF=$(TG_BOT_TOKEN="$TG_BOT_TOKEN" TG_OWNER_ID="$TG_OWNER_ID" \
  EXISTING_CONF="$EXISTING_CONF" \
  CC_CHECK_PROXY="${CC_CHECK_PROXY:-}" \
  CC_CHECK_PROXY_POOL="${CC_CHECK_PROXY_POOL:-}" \
  CC_CHECK_PROXY_TEMPLATE="${CC_CHECK_PROXY_TEMPLATE:-}" \
  CC_REQUIRE_PROXY="${CC_REQUIRE_PROXY:-}" \
  CC_CHECK_DEFAULT_CC="${CC_CHECK_DEFAULT_CC:-}" \
  CC_CLIENT_VERSION="${CC_CLIENT_VERSION:-}" \
  CC_CLIENT_SHA="${CC_CLIENT_SHA:-}" \
  TURNSTILE_SECRET="${TURNSTILE_SECRET:-}" \
  TURNSTILE_HOSTNAMES="${TURNSTILE_HOSTNAMES:-}" \
  python3 - <<'PY'
import json, os, secrets

try:
    existing = json.loads(os.environ.get("EXISTING_CONF") or "{}")
    if not isinstance(existing, dict):
        existing = {}
except Exception:
    existing = {}

payload = dict(existing)
payload["bot_token"] = os.environ["TG_BOT_TOKEN"]
payload["owner_id"] = int(os.environ["TG_OWNER_ID"])
payload["ingest_salt"] = existing.get("ingest_salt") or secrets.token_hex(16)


def take(env, key, *aliases):
    val = os.environ.get(env, "")
    if val.strip():
        payload[key] = val.strip()
        return
    for name in (key, *aliases):
        if existing.get(name):
            payload[key] = existing[name]
            return


take("CC_CHECK_PROXY", "check_proxy", "CC_CHECK_PROXY")
take("CC_CHECK_PROXY_POOL", "check_proxy_pool")
take("CC_CHECK_PROXY_TEMPLATE", "check_proxy_template")
take("CC_CHECK_DEFAULT_CC", "check_default_cc")
take("CC_CLIENT_VERSION", "client_version")
take("CC_CLIENT_SHA", "client_sha")
take("TURNSTILE_SECRET", "turnstile_secret")
take("TURNSTILE_HOSTNAMES", "turnstile_hostnames")

rp = os.environ.get("CC_REQUIRE_PROXY", "")
if rp.strip():
    payload["require_proxy"] = rp.strip().lower() in ("1", "true", "yes", "on")
elif "require_proxy" in existing:
    payload["require_proxy"] = existing["require_proxy"]

payload.pop("CC_CHECK_PROXY", None)  # normalise the legacy alias to check_proxy
print(json.dumps(payload))
PY
)
echo "$CONF" | "${SSH[@]}" 'install -d -m 0750 /etc/claudecookie && cat > /etc/claudecookie/bot.conf && chmod 0640 /etc/claudecookie/bot.conf'

echo "==> Installing services"
"${SSH[@]}" 'bash /tmp/cc-deploy/setup-stats.sh'

echo
echo "==> Done. Send the bot /start in Telegram."
