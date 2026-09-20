#!/usr/bin/env python3
"""Check one Claude session, or a small batch, through the public API."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "https://claudecookie.com").rstrip("/")


def post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode()
        print(f"HTTP {exc.code}: {payload}", file=sys.stderr)
        raise SystemExit(1) from exc


def main() -> None:
    pastes = [p for p in sys.argv[1:] if p] or [os.environ.get("COOKIE", "")]
    pastes = [p for p in pastes if p]
    if not pastes:
        print("pass a cookie paste as argv or set COOKIE", file=sys.stderr)
        raise SystemExit(2)

    if len(pastes) == 1:
        data = post("/api/v1/check", {"cookie": pastes[0]})
    else:
        data = post("/api/v1/check", {"cookies": pastes[:10]})

    print(json.dumps(data, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
