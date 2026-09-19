#!/usr/bin/env bash
# Write Turnstile secret into origin bot.conf. Reads .env; never prints the secret.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
set -a; source <(sed 's/\r$//' .env); set +a
: "${TURNSTILE_SECRET:?set TURNSTILE_SECRET in .env}"
TURNSTILE_HOSTNAMES="${TURNSTILE_HOSTNAMES:-claudecookie.com}"
KEY="${DEPLOY_SSH_KEY/#\~/$HOME}"
HOST="root@${DEPLOY_HOST}"

ssh -i "$KEY" -o BatchMode=yes "$HOST" python3 - <<PY
import json, os
from pathlib import Path
secret = ${TURNSTILE_SECRET@Q}
hostnames = ${TURNSTILE_HOSTNAMES@Q}
if not secret:
    raise SystemExit("empty secret")
path = Path("/etc/claudecookie/bot.conf")
data = json.loads(path.read_text(encoding="utf-8"))
data["turnstile_secret"] = secret
data["turnstile_hostnames"] = hostnames
path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
os.chmod(path, 0o640)
print("secret_len", len(secret))
print("has_secret", True)
print("hostnames", data["turnstile_hostnames"])
PY

ssh -i "$KEY" -o BatchMode=yes "$HOST" \
  "systemctl restart claudecookie-ingest claudecookie-bot && systemctl is-active claudecookie-ingest claudecookie-bot"
