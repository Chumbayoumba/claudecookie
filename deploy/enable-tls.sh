#!/usr/bin/env bash
#
# Obtains a Let's Encrypt certificate and switches nginx to the production
# config. Run on the server, as root, AFTER setup-server.sh and after the DNS
# record points at this machine.
#
#   ssh root@<host> 'bash /tmp/cc-deploy/enable-tls.sh'
#
# Behind a Cloudflare proxy the ACME HTTP-01 challenge still reaches us:
# Cloudflare forwards /.well-known/acme-challenge/ to the origin rather than
# answering it itself. Once this succeeds, set the Cloudflare SSL mode to
# "Full (strict)" so the edge verifies the origin certificate.

set -euo pipefail

DOMAIN="claudecookie.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMAIL="${CERTBOT_EMAIL:-}"

if [[ $EUID -ne 0 ]]; then
  echo "This script must run as root." >&2
  exit 1
fi

echo "==> Checking the domain resolves to this server"
server_ip="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo '')"
resolved="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || echo '')"
echo "    this server: ${server_ip:-unknown}"
echo "    $DOMAIN resolves to: ${resolved:-nothing}"
echo "    (a Cloudflare address here is expected while the domain is proxied)"

echo "==> Requesting a certificate"
reg_args=(--register-unsafely-without-email)
if [[ -n "$EMAIL" ]]; then
  reg_args=(--email "$EMAIL" --no-eff-email)
fi

if certbot certonly --webroot -w /var/www/certbot \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos "${reg_args[@]}" --keep-until-expiring; then
  echo "    certificate obtained"
else
  echo >&2
  echo "CERTIFICATE REQUEST FAILED." >&2
  echo "Most likely causes:" >&2
  echo "  * DNS does not point at this server yet" >&2
  echo "  * Cloudflare 'Always Use HTTPS' is redirecting the ACME challenge" >&2
  echo "    (add a Page Rule exempting /.well-known/acme-challenge/*)" >&2
  echo "The site stays live over HTTP; rerun this script once that is fixed." >&2
  exit 1
fi

echo "==> Installing the production configuration"
install -m 0644 "$SCRIPT_DIR/nginx.conf" "/etc/nginx/sites-available/$DOMAIN"
ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"

# Certbot ships these only once it has run at least one nginx-plugin install;
# with the webroot plugin they may be missing, and the config includes them.
[[ -f /etc/letsencrypt/options-ssl-nginx.conf ]] || \
  curl -fsS -o /etc/letsencrypt/options-ssl-nginx.conf \
    https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot/_internal/tls_configs/options-ssl-nginx.conf
[[ -f /etc/letsencrypt/ssl-dhparams.pem ]] || \
  openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048

nginx -t
systemctl reload nginx

echo "==> Renewal"
systemctl list-timers certbot.timer --no-pager 2>/dev/null | head -3 || true
certbot renew --dry-run --quiet && echo "    renewal dry run passed"

echo
echo "==> TLS is live at https://$DOMAIN"
echo "    Now set Cloudflare SSL/TLS mode to 'Full (strict)'."
