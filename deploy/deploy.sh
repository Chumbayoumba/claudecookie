#!/usr/bin/env bash
#
# Builds the site and ships it to the server.
#
#   cp .env.example .env   # fill in, then:
#   ./deploy/deploy.sh
#
# Releases are timestamped directories and `current` is a symlink, so the switch
# is atomic - a visitor mid-request never sees a half-uploaded tree - and rolling
# back is one symlink away.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "No .env found. Copy .env.example to .env and fill it in." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env; set +a

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

echo "==> Running tests"
pnpm test

echo "==> Building"
rm -rf out
pnpm build

if [[ ! -f out/en/index.html ]]; then
  echo "Build produced no out/en/index.html - refusing to deploy." >&2
  exit 1
fi

echo "==> Uploading release $RELEASE"
ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$TARGET'"

rsync -az --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  out/ "$DEPLOY_USER@$DEPLOY_HOST:$TARGET/"

echo "==> Switching the symlink and reloading nginx"
ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" bash -s <<REMOTE
set -euo pipefail

# ln -T avoids the classic trap where linking onto an existing symlink-to-a-dir
# creates the new link *inside* the old target instead of replacing it.
ln -sfnT '$TARGET' '$DEPLOY_PATH/current.new'
mv -Tf '$DEPLOY_PATH/current.new' '$DEPLOY_PATH/current'

sudo /usr/sbin/nginx -t
sudo /bin/systemctl reload nginx

# Keep the last $KEEP releases so a rollback is instant.
cd '$DEPLOY_PATH/releases'
ls -1t | tail -n +$((KEEP + 1)) | xargs -r rm -rf
REMOTE

echo "==> Verifying on the origin (over SSH via 127.0.0.1)"
# The origin is now locked to the RTK edge (and localhost), so a direct curl
# from this machine's IP would get 403. Verify from the server itself, where the
# loopback peer is trusted by the origin-lock.
"${SSH[@]}" bash -s <<REMOTE
for path in / /ru/ /zh/ /formats/netscape-cookies-txt/ /sitemap.xml; do
  code="\$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 \\
    --resolve "$DEPLOY_DOMAIN:443:127.0.0.1" "https://$DEPLOY_DOMAIN\$path" || echo 000)"
  printf '    %-36s %s\n' "\$path" "\$code"
done
REMOTE

echo "==> Verifying the private lock holds"
# From here (an untrusted IP) the site must refuse: 403 through the edge means
# the access lock works; a 200 would mean it is publicly reachable.
edge="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://$DEPLOY_DOMAIN/" || echo 000)"
echo "    https://$DEPLOY_DOMAIN/  (from here) -> $edge  (403 = locked, good)"
if [[ "$edge" == 200 ]]; then
  echo "    WARNING: the site is publicly reachable — the access lock is NOT in place."
fi

echo
echo "==> Deployed release $RELEASE"
echo "    Roll back with:"
echo "      ssh $DEPLOY_USER@$DEPLOY_HOST \"ln -sfnT $DEPLOY_PATH/releases/<older> $DEPLOY_PATH/current\""
