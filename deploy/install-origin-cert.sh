#!/usr/bin/env bash
#
# Installs a Cloudflare Origin CA certificate and switches nginx to the
# production config.
#
# This is the right certificate for a permanently proxied domain: Cloudflare
# issues it for 15 years, it costs nothing, and "Full (strict)" verifies it.
# Its one limitation is that only Cloudflare trusts it - if the proxy is ever
# turned off, browsers reaching the origin directly will warn. Use
# enable-tls.sh (Let's Encrypt) instead if that matters.
#
# Generate the pair at:
#   Cloudflare dashboard -> SSL/TLS -> Origin Server -> Create Certificate
#   (defaults are fine: RSA, hostnames claudecookie.com and *.claudecookie.com)
#
# Then, on the server as root:
#   bash install-origin-cert.sh
# and paste the certificate, then the private key, ending each with Ctrl-D.

set -euo pipefail

DOMAIN="claudecookie.com"
CERT_DIR="/etc/ssl/claudecookie"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "This script must run as root." >&2
  exit 1
fi

mkdir -p "$CERT_DIR"
chmod 700 "$CERT_DIR"

if [[ -n "${ORIGIN_CERT:-}" && -n "${ORIGIN_KEY:-}" ]]; then
  printf '%s\n' "$ORIGIN_CERT" > "$CERT_DIR/origin.pem"
  printf '%s\n' "$ORIGIN_KEY" > "$CERT_DIR/origin.key"
else
  echo "Paste the ORIGIN CERTIFICATE (-----BEGIN CERTIFICATE-----), then Ctrl-D:"
  cat > "$CERT_DIR/origin.pem"
  echo "Paste the PRIVATE KEY (-----BEGIN PRIVATE KEY-----), then Ctrl-D:"
  cat > "$CERT_DIR/origin.key"
fi

chmod 644 "$CERT_DIR/origin.pem"
chmod 600 "$CERT_DIR/origin.key"

echo "==> Validating the pair"
openssl x509 -in "$CERT_DIR/origin.pem" -noout -subject -dates
# A certificate and key that do not match will pass nginx -t and then fail every
# TLS handshake, so compare their public keys before going anywhere near reload.
cert_mod="$(openssl x509 -noout -modulus -in "$CERT_DIR/origin.pem" | openssl md5)"
key_mod="$(openssl rsa -noout -modulus -in "$CERT_DIR/origin.key" | openssl md5)"
if [[ "$cert_mod" != "$key_mod" ]]; then
  echo "Certificate and key do not match. Nothing was changed." >&2
  exit 1
fi
echo "    certificate and key match"

echo "==> Installing the production configuration"
sed -e "s#/etc/letsencrypt/live/$DOMAIN/fullchain.pem#$CERT_DIR/origin.pem#g" \
    -e "s#/etc/letsencrypt/live/$DOMAIN/privkey.pem#$CERT_DIR/origin.key#g" \
    -e "/options-ssl-nginx.conf/d" \
    -e "/ssl-dhparams.pem/d" \
    "$SCRIPT_DIR/nginx.conf" > "/etc/nginx/sites-available/$DOMAIN"

# The Let's Encrypt snippet carried the protocol and cipher settings, so set
# them explicitly now that it has been stripped out.
sed -i "s#^\( *\)ssl_certificate_key .*#&\n\1ssl_protocols TLSv1.2 TLSv1.3;\n\1ssl_prefer_server_ciphers off;\n\1ssl_session_cache shared:SSL:10m;\n\1ssl_session_timeout 1d;#" \
    "/etc/nginx/sites-available/$DOMAIN"

ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
nginx -t
systemctl reload nginx

echo
echo "==> Done. Set Cloudflare SSL/TLS mode to 'Full (strict)'."
