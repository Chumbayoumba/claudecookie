#!/usr/bin/env bash
# Public/origin smoke only. Never read stats.db blobs or live session cookies.
set -euo pipefail
echo "==> pages"
curl -skI -H "Host: claudecookie.com" https://127.0.0.1/credential/ | head -15
echo "==> csp"
curl -skI -H "Host: claudecookie.com" https://127.0.0.1/ru/credential/ | tr -d '\r' | grep -i content-security
echo "==> plaintext credential"
code=$(curl -sk -o /tmp/cred.json -w "%{http_code}" \
  -H "Host: claudecookie.com" \
  -H "Origin: https://claudecookie.com" \
  -H "Content-Type: application/json" \
  -X POST --data '{"cookie":"sessionKey=x","cf-turnstile-response":"t"}' \
  https://127.0.0.1/credential)
echo "http:$code"
cat /tmp/cred.json; echo
echo "==> ingest modules"
python3 -c 'import sys; sys.path.insert(0,"/opt/claudecookie"); import claude_oauth, turnstile; print("oauth_ok", claude_oauth.CLIENT_ID[:8]); print("action", turnstile.EXPECTED_ACTION)'
echo "==> secret not in static"
if grep -R "0x4AAAAAAE6gDX" /var/www/claudecookie/current >/dev/null; then echo SECRET_IN_STATIC; else echo static_clean; fi
if grep -R "0x4AAAAAAE6gDTNt891GoIWv" /var/www/claudecookie/current >/dev/null; then echo sitekey_present; else echo sitekey_missing; fi
echo "==> sitemap"
curl -sk -H "Host: claudecookie.com" https://127.0.0.1/sitemap.xml | grep -c credential || true
