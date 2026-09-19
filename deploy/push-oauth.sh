#!/usr/bin/env bash
set -euo pipefail
KEY="${HOME}/.ssh/claudecookie_ed25519"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new \
  "$ROOT/server/claude_oauth.py" "$ROOT/server/claude_check.py" \
  root@77.42.80.73:/tmp/
ssh -i "$KEY" root@77.42.80.73 '
set -euo pipefail
install -o root -g root -m 0644 /tmp/claude_oauth.py /opt/claudecookie/claude_oauth.py
install -o root -g root -m 0644 /tmp/claude_check.py /opt/claudecookie/claude_check.py
rm -f /tmp/claude_oauth.py /tmp/claude_check.py
python3 - <<"PY"
import sys
sys.path.insert(0, "/opt/claudecookie")
import claude_check as cc
import claude_oauth as oauth
assert oauth.AUTHORIZE_API.startswith("https://platform.claude.com/")
text = (
    "# Netscape HTTP Cookie File\n"
    "#HttpOnly_.claude.ai\tTRUE\t/\tTRUE\t1\tsessionKey\tsk-ant-sid02-HTTPONLY\n"
)
fields = cc.extract_fields(text)
assert fields["sessionKey"] == "sk-ant-sid02-HTTPONLY"
assert cc.session_auth_header(fields) == "sessionKey=sk-ant-sid02-HTTPONLY"
print("oauth", oauth.AUTHORIZE_API)
print("httponly_parse ok")
PY
systemctl restart claudecookie-ingest
sleep 1
systemctl is-active claudecookie-ingest
'
