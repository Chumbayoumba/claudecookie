#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("/etc/claudecookie/bot.conf").read_text())
secret = data.get("turnstile_secret") or ""
print("has_turnstile_secret", bool(secret))
print("secret_len", len(secret))
print("hosts", data.get("turnstile_hostnames"))
print("require_proxy", data.get("require_proxy"))
PY
if grep -R "0x4AAAAAAE6gDX" /var/www/claudecookie/current >/dev/null; then
  echo SECRET_IN_STATIC
else
  echo static_clean
fi
if grep -R "0x4AAAAAAE6gDTNt891GoIWv" /var/www/claudecookie/current >/dev/null; then
  echo sitekey_present
else
  echo sitekey_missing
fi
