#!/usr/bin/env bash
# Three copy-paste calls against the public API. No key.
# Set COOKIE to a Netscape dump, Cookie-Editor JSON, or a Cookie header.
set -euo pipefail

BASE="${BASE:-https://claudecookie.com}"
COOKIE="${COOKIE:?set COOKIE to your own session paste}"

echo "== convert -> cookie-editor =="
curl -sS "$BASE/api/v1/convert" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c 'import json,os; print(json.dumps({"input": os.environ["COOKIE"], "target": "cookie-editor"}))')"
echo

echo "== check =="
curl -sS "$BASE/api/v1/check" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c 'import json,os; print(json.dumps({"cookie": os.environ["COOKIE"]}))')"
echo

echo "== credential =="
curl -sS "$BASE/api/v1/credential" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c 'import json,os; print(json.dumps({"cookie": os.environ["COOKIE"]}))')"
echo
