#!/usr/bin/env bash
set -euo pipefail
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
echo "==> plaintext chrome UA"
code=$(curl -sk -o /tmp/cred.json -w "%{http_code}" \
  -A "$UA" \
  -H "Host: claudecookie.com" \
  -H "Origin: https://claudecookie.com" \
  -H "Content-Type: application/json" \
  -X POST --data '{"cookie":"sessionKey=x","cf-turnstile-response":"t"}' \
  https://127.0.0.1/credential)
echo "http:$code"
cat /tmp/cred.json; echo
echo "==> sitemap urls"
curl -sk -H "Host: claudecookie.com" https://127.0.0.1/sitemap.xml | grep -o 'https://claudecookie.com[^<]*credential[^<]*' || true
echo "==> robots"
curl -sk -H "Host: claudecookie.com" https://127.0.0.1/robots.txt | head -20
