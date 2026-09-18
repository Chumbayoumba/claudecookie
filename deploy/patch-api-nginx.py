#!/usr/bin/env python3
"""Install the public /api/v1/ nginx location and slash-redirect exemption.

Idempotent. Run on the origin as root after copying deploy/ next to this script.
"""

import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = Path("/etc/nginx/sites-enabled/claudecookie.com")
SNIPPETS = Path("/etc/nginx/snippets")
CONFD = Path("/etc/nginx/conf.d")

OLD_IFS = (
    r'if ($request_uri ~ "^(?!/(?:e|check|box)(\?|$))([^.?]*[^/])(\?.*)?$") {',
    r'if ($request_uri ~ "^(?!/(?:e|check|box|credential)(\?|$))([^.?]*[^/])(\?.*)?$") {',
)
NEW_IF = r'if ($request_uri ~ "^(?!/(?:e|check|box|credential)(\?|$)|/api/v1)([^.?]*[^/])(\?.*)?$") {'

LOCATION = """
    # Public JSON API. Prefix match so /api/ (the docs page) stays static.
    # CORP is cross-origin here; the website ingest routes stay same-origin.
    location ^~ /api/v1/ {
        include snippets/claudecookie-security-api.conf;
        add_header Cache-Control "no-store" always;
        access_log off;
        client_max_body_size 512k;
        # Accept a trailing slash so POST /api/v1/convert/ still hits ingest.
        rewrite ^(/api/v1/.+)/$ $1 last;
        limit_req zone=cc_api burst=20 nodelay;
        limit_req_status 429;
        error_page 429 = @api_v1_rate_limit;
        # Ingest also sets CORS; hide the upstream copy so the browser sees one *.
        proxy_hide_header Access-Control-Allow-Origin;
        proxy_hide_header Access-Control-Allow-Methods;
        proxy_hide_header Access-Control-Allow-Headers;
        proxy_hide_header Access-Control-Max-Age;
        proxy_hide_header Access-Control-Expose-Headers;
        proxy_hide_header Cross-Origin-Resource-Policy;
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-Client $remote_addr;
        proxy_set_header X-CC-Country $country_code;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location @api_v1_rate_limit {
        include snippets/claudecookie-security-api.conf;
        add_header Cache-Control "no-store" always;
        add_header Retry-After 1 always;
        default_type application/json;
        return 429 '{"ok":false,"invalidReason":"rate_limited"}';
    }
"""

EXISTING_BLOCK = re.compile(
    r"(?:\n    # Public JSON API[^\n]*\n(?:    #[^\n]*\n)*)?"
    r"    location \^~ /api/v1/ \{.*?\n    \}\n"
    r"(?:\n    location @api_v1_rate_limit \{.*?\n    \}\n)?",
    re.S,
)


def main() -> None:
    (SNIPPETS / "claudecookie-security-api.conf").write_text(
        (HERE / "security-headers-api.conf").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    (CONFD / "00-api-limit.conf").write_text(
        (HERE / "00-api-limit.conf").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    print("installed api snippet and limit_req zone")

    site = SITE.read_text(encoding="utf-8")
    for old in OLD_IFS:
        if old in site:
            site = site.replace(old, NEW_IF, 1)
            print("site: updated slash-redirect lookahead")
            break
    else:
        if NEW_IF in site:
            print("site: slash-redirect already exempts /api/v1")
        else:
            raise SystemExit("slash-redirect if() not found")

    if EXISTING_BLOCK.search(site):
        site = EXISTING_BLOCK.sub("\n" + LOCATION.lstrip("\n") + "\n", site, count=1)
        print("site: replaced /api/v1/ location")
    else:
        needle = "    location = /index.txt {"
        if needle not in site:
            raise SystemExit("index.txt location missing; cannot insert /api/v1/")
        site = site.replace(needle, LOCATION.lstrip("\n") + "\n    location = /index.txt {", 1)
        print("site: added /api/v1/")

    SITE.write_text(site, encoding="utf-8")


if __name__ == "__main__":
    main()
