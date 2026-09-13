#!/usr/bin/env python3
"""One-off diagnostic: does checking a Claude session rotate or kill it?

Run this MANUALLY with a THROWAWAY session you don't mind losing. It hits the
candidate endpoints one at a time, captures Set-Cookie, and reports whether the
session key rotated -- names and booleans only, never the secret values. Between
endpoints it pauses so you can switch to the browser and confirm the live tab is
not logged out and a fresh re-export of the same cookie is still valid.

Usage:
    python3 diag_rotation.py path/to/cookie.txt      # interactive pauses
    pbpaste | python3 diag_rotation.py -             # no pauses (piped)

Route it through the residential proxy you plan to use for the real checker:
    CC_CHECK_PROXY=socks5://user:pass@host:1080 python3 diag_rotation.py cookie.txt
    CC_DIAG_COUNTRY=DE  (optional, for a geo/sticky template proxy)

The goal: pick the lightest endpoint that stays authenticated with rotated=no.
"""

from __future__ import annotations

import os
import sys

import claude_check as cc

# (label, url, needs an org id in the path)
STATIC_ENDPOINTS = [
    ("bootstrap", cc.BOOTSTRAP_URL),
    ("organizations", "https://claude.ai/api/organizations"),
    ("account", "https://claude.ai/api/account"),
]


def load_raw(arg: str | None) -> str:
    if not arg or arg == "-":
        return sys.stdin.read()
    with open(arg, encoding="utf-8") as handle:
        return handle.read()


def rotation_of(original: dict, set_cookie: dict | None) -> list[str]:
    changed = []
    for name in cc.SESSION_NAMES:
        value = (set_cookie or {}).get(name)
        if value and value != original.get(name):
            changed.append(name)
    return changed


def main() -> int:
    raw = load_raw(sys.argv[1] if len(sys.argv) > 1 else "-")
    try:
        fields = cc.extract_fields(raw)
    except cc.CookieParseError as exc:
        print(f"cannot parse cookie: {exc}")
        return 2

    original = dict(fields)
    device = fields.get("anthropic-device-id")
    sid = cc.session_key_hash(raw)
    country = (os.environ.get("CC_DIAG_COUNTRY") or "").upper()[:2] or None
    proxy = cc.select_proxy(country, sid)

    print(f"session={sid} country={country or '-'} "
          f"proxy={'yes' if proxy else 'NO -- egressing from the datacenter IP!'}")
    have = ",".join(name for name in cc.SET_COOKIE_NAMES if fields.get(name)) or "-"
    print(f"cookie carries: {have}\n")

    endpoints = list(STATIC_ENDPOINTS)
    org = fields.get("lastActiveOrg")
    if org:
        endpoints.append(("usage", "https://claude.ai" + cc.USAGE_PATH.format(org=org)))

    live = dict(fields)
    for label, url in endpoints:
        header = cc.cookie_header(live)
        status, body, set_cookie = cc.default_http_get(
            url, header, device, country=country, session_id=sid
        )
        authed = cc.is_authenticated_payload(body) if isinstance(body, (dict, list)) else False
        rotated = rotation_of(original, set_cookie)
        set_names = ",".join((set_cookie or {}).keys()) or "-"
        print(f"[{label}] status={status} authenticated={authed} "
              f"set-cookie={set_names} rotated={','.join(rotated) or 'no'}")
        if rotated:
            for name in rotated:
                live[name] = set_cookie[name]
            print(f"    !! {label} rotated {','.join(rotated)} -- the original snapshot is now stale.")
        print("    -> switch to the browser: is the tab still logged in? is a re-export still valid?")
        print("       press Enter to continue...", end="", flush=True)
        try:
            input()
        except EOFError:
            print()

    print("\nPick the lightest endpoint that stays authenticated with rotated=no.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
