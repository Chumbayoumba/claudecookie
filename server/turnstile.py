#!/usr/bin/env python3
"""Cloudflare Turnstile siteverify for POST /credential.

The widget secret never leaves the origin env / bot.conf. The browser only
holds the public sitekey. Siteverify is called from this host, not via the
residential Claude proxy: there is no user session on that hop.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable

CONF_PATH_ENV = "CC_STATS_CONF"
DEFAULT_CONF_PATH = "/etc/claudecookie/bot.conf"
SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
EXPECTED_ACTION = "credential"
DEFAULT_HOSTNAMES = frozenset({"claudecookie.com"})
MAX_TOKEN = 2048

SiteverifyFetch = Callable[[str, dict[str, str]], dict[str, Any]]


def _read_conf() -> dict[str, Any]:
    path = os.environ.get(CONF_PATH_ENV) or DEFAULT_CONF_PATH
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return {}
    return data if isinstance(data, dict) else {}


def turnstile_secret() -> str:
    raw = (os.environ.get("TURNSTILE_SECRET") or "").strip()
    if raw:
        return raw
    value = _read_conf().get("turnstile_secret")
    return value.strip() if isinstance(value, str) else ""


def turnstile_hostnames() -> set[str]:
    raw = (os.environ.get("TURNSTILE_HOSTNAMES") or "").strip()
    if raw:
        names = {part.strip().lower() for part in raw.split(",") if part.strip()}
        return names
    value = _read_conf().get("turnstile_hostnames")
    if isinstance(value, list):
        names = {str(item).strip().lower() for item in value if str(item).strip()}
        if names:
            return names
    if isinstance(value, str) and value.strip():
        return {part.strip().lower() for part in value.split(",") if part.strip()}
    return set(DEFAULT_HOSTNAMES)


def _default_fetch(url: str, fields: dict[str, str]) -> dict[str, Any]:
    body = urllib.parse.urlencode(fields).encode()
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            raw = response.read()
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return {}
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def verify_turnstile(
    token: str,
    remote_ip: str | None = None,
    *,
    fetch: SiteverifyFetch | None = None,
) -> tuple[bool, str]:
    """Return (ok, reason). Never includes the secret or the token."""
    if not isinstance(token, str) or not token or len(token) > MAX_TOKEN:
        return False, "captcha_failed"
    secret = turnstile_secret()
    hostnames = turnstile_hostnames()
    if not secret or not hostnames:
        return False, "captcha_failed"

    fields = {
        "secret": secret,
        "response": token,
    }
    if remote_ip:
        fields["remoteip"] = remote_ip
    try:
        result = (fetch or _default_fetch)(SITEVERIFY_URL, fields)
    except Exception:
        return False, "captcha_failed"
    if not result.get("success"):
        return False, "captcha_failed"
    if result.get("action") != EXPECTED_ACTION:
        return False, "captcha_failed"
    hostname = str(result.get("hostname") or "").strip().lower()
    if hostname not in hostnames:
        return False, "captcha_failed"
    return True, ""
