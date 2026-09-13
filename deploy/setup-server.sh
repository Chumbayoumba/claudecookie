#!/usr/bin/env bash
#
# One-time server preparation for claudecookie.com.
# Run this ON the server, as root:
#
#   scp -r deploy root@<host>:/tmp/cc-deploy
#   ssh root@<host> 'bash /tmp/cc-deploy/setup-server.sh'
#
# It is idempotent: running it again re-applies the configuration without
# duplicating anything.
#
# The domain sits behind a filtering proxy (RTK web protection), so this script
# also restores real client IPs from X-Forwarded-For. See 00-geo.conf for why
# geolocation refuses to act when that restoration has not happened.

set -euo pipefail

DOMAIN="claudecookie.com"
WEBROOT="/var/www/claudecookie"
GEOIP_DIR="/var/lib/geoip"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "This script must run as root." >&2
  exit 1
fi

echo "==> Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx rsync curl ufw

# The geoip2 module is only a fallback for the case where the Cloudflare proxy
# is switched off, so a missing package must not fail the setup.
GEOIP_AVAILABLE=0
if apt-get install -y -qq libnginx-mod-http-geoip2 2>/dev/null; then
  GEOIP_AVAILABLE=1
  echo "    geoip2 module installed (offline fallback available)"
else
  echo "    geoip2 module unavailable on this release - Cloudflare header only"
fi

echo "==> Creating directories"
mkdir -p "$WEBROOT/releases" /var/www/certbot "$GEOIP_DIR" /etc/nginx/snippets

echo "==> Restoring real client IPs behind the protection proxy"
# The trust list is deliberately a static file rather than something fetched at
# setup time: whoever edits it should see exactly which networks are allowed to
# rewrite a client address.
bash "$SCRIPT_DIR/gen-proxy-trust.sh"
rm -f /etc/nginx/conf.d/00-cloudflare-realip.conf

echo "==> Installing the geo configuration"
cp "$SCRIPT_DIR/00-geo.conf" /etc/nginx/conf.d/00-geo.conf
if [[ $GEOIP_AVAILABLE -eq 1 ]]; then
  install -m 0755 "$SCRIPT_DIR/geoip-update.sh" /usr/local/bin/claudecookie-geoip-update
  CC_SKIP_RELOAD=1 /usr/local/bin/claudecookie-geoip-update || true

  if [[ -s "$GEOIP_DIR/dbip-country-lite.mmdb" ]]; then
    cat "$SCRIPT_DIR/00-geo-source-with-db.conf" >> /etc/nginx/conf.d/00-geo.conf
    # Refresh on the 3rd of each month, after DB-IP publishes the new edition.
    printf '17 4 3 * * root /usr/local/bin/claudecookie-geoip-update >/dev/null 2>&1\n' \
      > /etc/cron.d/claudecookie-geoip
    chmod 0644 /etc/cron.d/claudecookie-geoip
  else
    echo "    database download failed - falling back to Cloudflare header only"
    cat "$SCRIPT_DIR/00-geo-source-cf-only.conf" >> /etc/nginx/conf.d/00-geo.conf
  fi
else
  cat "$SCRIPT_DIR/00-geo-source-cf-only.conf" >> /etc/nginx/conf.d/00-geo.conf
fi

chmod 0644 /etc/nginx/conf.d/00-geo.conf
install -m 0644 "$SCRIPT_DIR/security-headers.conf" /etc/nginx/snippets/claudecookie-security.conf

echo "==> Bringing the site up over HTTP"
# The production config references certificates that may not exist yet, so serve
# plain HTTP first. This is also what lets certbot complete its challenge.
cat > "/etc/nginx/sites-available/$DOMAIN" <<BOOTSTRAP
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name $DOMAIN www.$DOMAIN;
    root $WEBROOT/current;
    index index.html;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }

    location = / { try_files /en/index.html =404; }
    location / { try_files \$uri \$uri/ /en\$uri /en\$uri/ =404; }
}
BOOTSTRAP

if [[ ! -e "$WEBROOT/current" ]]; then
  mkdir -p "$WEBROOT/releases/bootstrap/en"
  echo '<!doctype html><title>claudecookie</title><p>Deploying.' \
    > "$WEBROOT/releases/bootstrap/en/index.html"
  ln -sfnT "$WEBROOT/releases/bootstrap" "$WEBROOT/current"
fi

ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "==> Firewall"
# SSH is allowed before the firewall is switched on, so this cannot lock us out.
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status verbose | head -20

echo "==> Creating the deploy user"
# Deploys should not run as root. This account owns the webroot and may reload
# nginx, and nothing else.
if ! id -u deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chown -R deploy:deploy "$WEBROOT"

cat > /etc/sudoers.d/claudecookie-deploy <<'SUDO'
deploy ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /bin/systemctl reload nginx
SUDO
chmod 0440 /etc/sudoers.d/claudecookie-deploy

echo
echo "==> HTTP is live. Next: obtain a certificate with ./enable-tls.sh"
