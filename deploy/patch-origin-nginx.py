#!/usr/bin/env python3
"""Patch live nginx for POST /credential and Turnstile CSP. Idempotent."""

from pathlib import Path

SITE = Path("/etc/nginx/sites-enabled/claudecookie.com")
CSP = Path("/etc/nginx/snippets/claudecookie-security.conf")

OLD_IF = r'if ($request_uri ~ "^(?!/(?:e|check|box)(\?|$))([^.?]*[^/])(\?.*)?$") {'
NEW_IF = r'if ($request_uri ~ "^(?!/(?:e|check|box|credential)(\?|$))([^.?]*[^/])(\?.*)?$") {'

LOCATION = """
    # Cookie → Claude Code credentials.json. Exact /credential (no slash) so it
    # does not collide with the static page at /credential/.
    location = /credential {
        include snippets/claudecookie-security.conf;
        add_header Cache-Control "no-store" always;
        access_log off;
        client_max_body_size 512k;
        proxy_pass http://127.0.0.1:8787/credential;
        proxy_set_header Host $host;
        proxy_set_header X-Real-Client $remote_addr;
        proxy_set_header X-CC-Country $country_code;
        proxy_read_timeout 60s;
    }
"""

OLD_CSP = (
    "script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://yastatic.net; "
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: https://mc.yandex.ru https://yastatic.net; "
    "font-src 'self'; connect-src 'self' https://mc.yandex.ru https://mc.webvisor.com "
    "https://mc.webvisor.org blob:; frame-src https://mc.yandex.ru; "
)
NEW_CSP = (
    "script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://yastatic.net "
    "https://challenges.cloudflare.com; "
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: https://mc.yandex.ru https://yastatic.net; "
    "font-src 'self'; connect-src 'self' https://mc.yandex.ru https://mc.webvisor.com "
    "https://mc.webvisor.org https://challenges.cloudflare.com blob:; "
    "frame-src https://mc.yandex.ru https://challenges.cloudflare.com; "
)


def main() -> None:
    site = SITE.read_text(encoding="utf-8")
    if "location = /credential" not in site:
        if "location = /check {" not in site:
            raise SystemExit("check location missing")
        site = site.replace(OLD_IF, NEW_IF, 1)
        needle = "        proxy_read_timeout 45s;\n    }\n\n    # Next fetches this"
        if needle not in site:
            raise SystemExit("check location tail missing")
        site = site.replace(
            needle,
            "        proxy_read_timeout 45s;\n    }\n" + LOCATION + "\n    # Next fetches this",
            1,
        )
        SITE.write_text(site, encoding="utf-8")
        print("site: added /credential")
    else:
        print("site: /credential already present")

    csp = CSP.read_text(encoding="utf-8")
    if "challenges.cloudflare.com" not in csp:
        if OLD_CSP not in csp:
            raise SystemExit("csp pattern missing")
        CSP.write_text(csp.replace(OLD_CSP, NEW_CSP, 1), encoding="utf-8")
        print("csp: added turnstile hosts")
    else:
        print("csp: turnstile hosts already present")


if __name__ == "__main__":
    main()
