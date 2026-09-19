#!/usr/bin/env bash
#
# Uploads an already-built `out/` tree. Used when tests+build already ran
# on Windows and only the WSL deploy key can reach the server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "No .env found." >&2
  exit 1
fi
if [[ ! -f out/en/index.html ]]; then
  echo "No out/en/index.html — build first." >&2
  exit 1
fi
if [[ ! -f out/llms.txt ]]; then
  echo "No out/llms.txt — refusing to ship a tree without the API discovery file." >&2
  exit 1
fi

set -a; source <(sed 's/\r$//' .env); set +a

: "${DEPLOY_HOST:?set DEPLOY_HOST in .env}"
: "${DEPLOY_USER:?set DEPLOY_USER in .env}"
: "${DEPLOY_PATH:?set DEPLOY_PATH in .env}"
DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-claudecookie.com}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"

SSH_OPTS=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "${DEPLOY_SSH_KEY/#\~/$HOME}")
fi

RELEASE="$(date -u +%Y%m%d-%H%M%S)"
TARGET="$DEPLOY_PATH/releases/$RELEASE"
KEEP=5

echo "==> Uploading release $RELEASE"
ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$TARGET'"

rsync -az --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  out/ "$DEPLOY_USER@$DEPLOY_HOST:$TARGET/"

echo "==> Switching the symlink and reloading nginx"
ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" bash -s <<REMOTE
set -euo pipefail
ln -sfnT '$TARGET' '$DEPLOY_PATH/current.new'
mv -Tf '$DEPLOY_PATH/current.new' '$DEPLOY_PATH/current'
sudo /usr/sbin/nginx -t
sudo /bin/systemctl reload nginx
cd '$DEPLOY_PATH/releases'
ls -1t | tail -n +$((KEEP + 1)) | xargs -r rm -rf
REMOTE

echo "==> Verifying on the origin (over SSH via 127.0.0.1)"
ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" bash -s <<REMOTE
for path in / /ru/ /zh/ /api/ /ru/api/ /zh/api/ /check/ /ru/check/ /zh/check/ /formats/netscape-cookies-txt/ /sitemap.xml /openapi.json /llms.txt; do
  code="\$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 \\
    --resolve "$DEPLOY_DOMAIN:443:127.0.0.1" "https://$DEPLOY_DOMAIN\$path" || echo 000)"
  printf '    %-36s %s\n' "\$path" "\$code"
done
REMOTE

echo "==> Deployed release $RELEASE"
