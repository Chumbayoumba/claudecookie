#!/usr/bin/env python3
"""Inspect a Claude.ai session cookie: account, plan, 5h/weekly usage.

Used by the ingest service. HTTP is injectable so tests never touch the network.
Live session values are never written to logs.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable

SESSION_NAMES = ("sessionKey", "sessionKeyV3")
OPTIONAL_NAMES = (
    "lastActiveOrg",
    "anthropic-device-id",
    "sessionKeyLC",
    "sessionKeyV3LC",
    "routingHint",
)
BOOTSTRAP_URL = "https://claude.ai/api/bootstrap"
USAGE_PATH = "/api/organizations/{org}/usage?include_utilization=true"
CHROME_IMPERSONATE = ("chrome150", "chrome146", "chrome136", "chrome131")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)

HttpGet = Callable[[str, str, str | None], tuple[int, Any]]
_working_impersonate: str | None = None


class CookieParseError(ValueError):
    """The paste is not a cookie file we can read a Claude session from."""


def extract_fields(raw: str) -> dict[str, str]:
    text = (raw or "").strip()
    if not text:
        raise CookieParseError("empty")
    fields: dict[str, str] = {}
    if text[:1] in "[{":
        fields.update(_from_json(text))
    if not fields:
        fields.update(_from_netscape(text))
    if not any(fields.get(name) for name in SESSION_NAMES):
        fields.update(_from_header(text))
    if not any(fields.get(name) for name in SESSION_NAMES):
        raise CookieParseError("missing_session")
    return fields


def _from_json(text: str) -> dict[str, str]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return {}
    if isinstance(data, dict) and isinstance(data.get("data"), (list, dict)):
        data = data["data"]
    rows: list = data if isinstance(data, list) else [data] if isinstance(data, dict) else []
    out: dict[str, str] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or row.get("Name") or "").strip()
        value = row.get("value") if "value" in row else row.get("Value")
        if name and value is not None and name in SESSION_NAMES + OPTIONAL_NAMES:
            out[name] = str(value)
    return out


def _from_netscape(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 7:
            continue
        name, value = parts[5].strip(), parts[6]
        if name in SESSION_NAMES + OPTIONAL_NAMES:
            out[name] = value
    return out


def _from_header(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for part in re.split(r";\s*", text):
        if "=" not in part:
            continue
        name, value = part.split("=", 1)
        name = name.strip()
        if name in SESSION_NAMES + OPTIONAL_NAMES:
            out[name] = value.strip()
    return out


def cookie_header(fields: dict[str, str]) -> str:
    pairs = []
    for name in SESSION_NAMES + OPTIONAL_NAMES:
        value = fields.get(name)
        if value:
            pairs.append(f"{name}={value}")
    return "; ".join(pairs)


def configured_proxy() -> str | None:
    raw = (os.environ.get("CC_CHECK_PROXY") or "").strip()
    if raw:
        return raw
    path = os.environ.get("CC_STATS_CONF", "/etc/claudecookie/bot.conf")
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError, TypeError):
        return None
    if not isinstance(data, dict):
        return None
    value = data.get("check_proxy") or data.get("CC_CHECK_PROXY") or ""
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _request_headers(url: str, cookie: str, device_id: str | None) -> dict[str, str]:
    referer = (
        "https://claude.ai/settings/usage" if "/usage" in url else "https://claude.ai/"
    )
    headers = {
        "Cookie": cookie,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://claude.ai",
        "Referer": referer,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
    }
    if device_id:
        headers["anthropic-device-id"] = device_id
    return headers


def default_http_get(url: str, cookie: str, device_id: str | None) -> tuple[int, Any]:
    headers = _request_headers(url, cookie, device_id)
    proxy = configured_proxy()
    try:
        from curl_cffi import requests as cf
    except ImportError:
        return _urllib_get(url, headers, proxy)
    return _curl_cffi_get(cf, url, headers, proxy)


def _proxy_map(proxy: str | None) -> dict[str, str] | None:
    if not proxy:
        return None
    return {"http": proxy, "https": proxy}


def _curl_cffi_get(cf: Any, url: str, headers: dict[str, str], proxy: str | None) -> tuple[int, Any]:
    global _working_impersonate
    names: list[str] = []
    if _working_impersonate:
        names.append(_working_impersonate)
    for name in CHROME_IMPERSONATE:
        if name not in names:
            names.append(name)
    kwargs: dict[str, Any] = {
        "headers": headers,
        "timeout": 20,
        "allow_redirects": False,
    }
    proxies = _proxy_map(proxy)
    if proxies:
        kwargs["proxies"] = proxies
    for name in names:
        try:
            resp = cf.get(url, impersonate=name, **kwargs)
        except Exception as exc:
            message = str(exc).lower()
            if "impersonat" in message or "not supported" in message:
                continue
            return 0, None
        _working_impersonate = name
        return resp.status_code, _decode_body(resp.content)
    return 0, None


def _urllib_get(url: str, headers: dict[str, str], proxy: str | None) -> tuple[int, Any]:
    req = urllib.request.Request(url, method="GET")
    for key, value in headers.items():
        req.add_header(key, value)
    if "User-Agent" not in headers:
        req.add_header("User-Agent", USER_AGENT)
    handlers = []
    proxies = _proxy_map(proxy)
    if proxies:
        handlers.append(urllib.request.ProxyHandler(proxies))
    opener = urllib.request.build_opener(*handlers) if handlers else urllib.request.build_opener()
    try:
        with opener.open(req, timeout=20) as resp:
            return resp.status, _decode_body(resp.read())
    except urllib.error.HTTPError as exc:
        raw = exc.read() if exc.fp else b""
        return exc.code, _decode_body(raw)
    except Exception:
        return 0, None


def _decode_body(raw: bytes) -> Any:
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def first_string(obj: Any, names: tuple[str, ...]) -> str | None:
    found: list[str] = []

    def walk(node: Any) -> None:
        if found:
            return
        if isinstance(node, dict):
            for name in names:
                value = node.get(name)
                if isinstance(value, str) and value.strip():
                    found.append(value.strip())
                    return
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(obj)
    return found[0] if found else None


def collect_strings(obj: Any, names: tuple[str, ...]) -> list[str]:
    out: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for name in names:
                value = node.get(name)
                if isinstance(value, str) and value.strip():
                    out.append(value.strip())
                elif isinstance(value, list):
                    out.extend(str(item) for item in value if item)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(obj)
    return out


def collect_capabilities(obj: Any) -> list[str]:
    caps: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            value = node.get("capabilities")
            if isinstance(value, list):
                caps.extend(str(item) for item in value if item)
            for child in node.values():
                walk(child)
        elif isinstance(node, list):
            for child in node:
                walk(child)

    walk(obj)
    return caps


def plan_label(*blobs: Any) -> str:
    caps = []
    hints: list[str] = []
    for blob in blobs:
        caps.extend(collect_capabilities(blob))
        hints.extend(
            collect_strings(
                blob,
                (
                    "subscriptionLabel",
                    "subscriptionType",
                    "subscription_type",
                    "plan",
                    "planLabel",
                    "rate_limit_tier",
                    "rateLimitTier",
                    "raven_type",
                    "billing_type",
                ),
            )
        )
    joined = " ".join(caps + hints).lower()
    if re.search(r"max[_\s-]*20|20\s*x|20x", joined):
        return "Claude Max 20x"
    if re.search(r"max[_\s-]*5|5\s*x|5x", joined) and "max" in joined:
        return "Claude Max 5x"
    if re.search(r"pro[_\s-]*5|5\s*x|5x", joined) and "pro" in joined:
        return "Claude Pro 5x"
    if "claude_max" in caps or "max" in joined:
        return "Claude Max"
    if "claude_pro" in caps or re.search(r"\bpro\b", joined):
        return "Claude Pro"
    if "team" in joined:
        return "Claude Team"
    if "enterprise" in joined:
        return "Claude Enterprise"
    if caps or hints:
        return "Claude Free"
    return "Claude"


def _as_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _percent(value: Any) -> int | None:
    number = _as_float(value)
    if number is None:
        return None
    if 0 <= number <= 1:
        return int(round(number * 100))
    if 0 <= number <= 100:
        return int(round(number))
    return None


def _parse_reset(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        ts = float(value)
        if ts > 10_000_000_000:
            ts /= 1000
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    if isinstance(value, str):
        text = value.strip()
        if text.isdigit():
            return _parse_reset(int(text))
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def resets_in(value: Any, now: datetime | None = None) -> str | None:
    when = _parse_reset(value)
    if when is None:
        return None
    now = now or datetime.now(timezone.utc)
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    seconds = int((when - now).total_seconds())
    if seconds <= 0:
        return "now"
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
    if days:
        return f"{days}d"
    if hours:
        return f"{hours}h"
    return f"{max(minutes, 1)}m"


def _window_from_dict(node: dict) -> dict | None:
    percent = None
    for key in (
        "utilization",
        "used_percent",
        "usedPercent",
        "percent",
        "percentage",
        "used",
    ):
        if key in node:
            percent = _percent(node[key])
            if percent is not None:
                break
    used = _as_float(node.get("used") or node.get("usage") or node.get("tokens_used"))
    limit = _as_float(node.get("limit") or node.get("allotment") or node.get("tokens_limit"))
    if percent is None and used is not None and limit and limit > 0:
        percent = _percent(used / limit)
    reset_raw = (
        node.get("resets_at")
        or node.get("reset_at")
        or node.get("resetsAt")
        or node.get("resetAt")
        or node.get("reset")
    )
    reset = resets_in(reset_raw)
    if percent is None and reset is None:
        return None
    return {"percent": percent, "resets": reset, "resetsAt": reset_raw}


def _classify_window(name: str) -> str | None:
    lowered = name.lower()
    if any(token in lowered for token in ("five_hour", "fivehour", "5h", "session", "5_hour")):
        return "session"
    if any(token in lowered for token in ("seven_day", "sevenday", "7d", "week", "weekly")):
        return "weekly"
    return None


def pick_windows(obj: Any) -> dict[str, dict]:
    found: dict[str, dict] = {}

    def take(kind: str, window: dict) -> None:
        if kind not in found:
            found[kind] = window

    def walk(node: Any, inherited: str | None = None) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                kind = _classify_window(str(key)) or inherited
                if isinstance(value, dict):
                    window = _window_from_dict(value)
                    if window and kind:
                        take(kind, window)
                    walk(value, kind)
                elif kind and key in {"utilization", "used_percent", "percent"}:
                    percent = _percent(value)
                    if percent is not None:
                        take(kind, {"percent": percent, "resets": None, "resetsAt": None})
                else:
                    walk(value, kind)
        elif isinstance(node, list):
            for item in node:
                walk(item, inherited)

    walk(obj)
    return found


def org_ids_from(*blobs: Any) -> list[str]:
    ids: list[str] = []
    for blob in blobs:
        value = first_string(blob, ("uuid", "organization_uuid", "org_uuid"))
        if value and value not in ids:
            ids.append(value)
        if isinstance(blob, list):
            for item in blob:
                if isinstance(item, dict):
                    uid = item.get("uuid") or item.get("id")
                    if isinstance(uid, str) and uid not in ids:
                        ids.append(uid)
        if isinstance(blob, dict):
            data = blob.get("data") or blob.get("organizations")
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        uid = item.get("uuid") or item.get("id")
                        if isinstance(uid, str) and uid not in ids:
                            ids.append(uid)
    return ids


def is_authenticated_payload(body: Any) -> bool:
    """Public /api/bootstrap is 200 with account=null; that is not a session."""
    if isinstance(body, list):
        return any(
            isinstance(item, dict)
            and (
                item.get("uuid")
                or item.get("email_address")
                or item.get("email")
            )
            for item in body
        )
    if not isinstance(body, dict):
        return False
    account = body.get("account")
    if isinstance(account, dict):
        email = account.get("email_address") or account.get("email")
        if isinstance(email, str) and email.strip():
            return True
        memberships = account.get("memberships")
        if isinstance(memberships, list) and memberships:
            return True
    email = body.get("email_address") or body.get("email")
    if isinstance(email, str) and email.strip():
        return True
    orgs = body.get("organizations") or body.get("data")
    if isinstance(orgs, list) and any(
        isinstance(item, dict) and (item.get("uuid") or item.get("id"))
        for item in orgs
    ):
        return True
    return False


def _probe_info(probes: list[dict[str, Any]], started: float) -> dict[str, Any]:
    return {
        "statuses": [item["status"] for item in probes],
        "paths": [item["path"] for item in probes],
        "elapsed_ms": int((time.monotonic() - started) * 1000),
    }


def _reject(reason: str, probes: list[dict[str, Any]], started: float) -> dict:
    return {
        "ok": False,
        "invalidReason": reason,
        "probe": _probe_info(probes, started),
    }


def format_check_log(result: dict) -> str:
    probe = result.get("probe") if isinstance(result.get("probe"), dict) else {}
    statuses = ",".join(str(item) for item in (probe.get("statuses") or []))
    paths = ",".join(str(item) for item in (probe.get("paths") or []))
    ms = probe.get("elapsed_ms")
    if result.get("ok"):
        outcome = "valid"
    else:
        outcome = str(result.get("invalidReason") or "invalid")
    return f"check {outcome} statuses={statuses} paths={paths} ms={ms}"


def check_cookie(raw: str, http_get: HttpGet | None = None) -> dict:
    started = time.monotonic()
    probes: list[dict[str, Any]] = []
    getter = http_get or default_http_get
    try:
        fields = extract_fields(raw)
    except CookieParseError as exc:
        return _reject(str(exc) or "missing_session", probes, started)

    header = cookie_header(fields)
    device = fields.get("anthropic-device-id")
    org_hint = fields.get("lastActiveOrg")

    status, body = getter(BOOTSTRAP_URL, header, device)
    probes.append({"path": "bootstrap", "status": status})
    if status in {401, 403}:
        return _reject("expired", probes, started)
    if status != 200 or body is None:
        return _reject("unreachable", probes, started)
    if not is_authenticated_payload(body):
        return _reject("expired", probes, started)

    blobs: list[Any] = [body]
    windows: dict[str, dict] = {}
    for kind, window in pick_windows(body).items():
        windows.setdefault(kind, window)

    if "session" not in windows or "weekly" not in windows:
        org = org_hint or (org_ids_from(*blobs)[0] if org_ids_from(*blobs) else None)
        if org:
            usage_url = "https://claude.ai" + USAGE_PATH.format(org=org)
            status, usage = getter(usage_url, header, device)
            probes.append({"path": "usage", "status": status})
            if status == 200 and usage is not None:
                blobs.append(usage)
                for kind, window in pick_windows(usage).items():
                    windows.setdefault(kind, window)

    email = None
    name = None
    org_name = None
    for blob in blobs:
        email = email or first_string(blob, ("email_address", "email"))
        name = name or first_string(blob, ("full_name", "display_name", "name"))
        if isinstance(blob, dict):
            org = blob.get("account") or blob.get("organization")
            if isinstance(org, dict):
                org_name = org_name or (
                    org.get("name") if isinstance(org.get("name"), str) else None
                )
            memberships = blob.get("account", {})
            if isinstance(memberships, dict):
                mems = memberships.get("memberships")
                if isinstance(mems, list) and mems and isinstance(mems[0], dict):
                    nested = mems[0].get("organization")
                    if isinstance(nested, dict) and isinstance(nested.get("name"), str):
                        org_name = org_name or nested.get("name")

    org_id = org_hint or (org_ids_from(*blobs)[0] if org_ids_from(*blobs) else None)
    caps = []
    for blob in blobs:
        caps.extend(collect_capabilities(blob))
    caps = list(dict.fromkeys(caps))

    extras = {
        "organizationId": org_id,
        "organizationName": org_name,
        "deviceId": device,
        "capabilities": caps,
    }
    extras = {key: value for key, value in extras.items() if value}

    return {
        "ok": True,
        "email": email,
        "name": name,
        "planLabel": plan_label(*blobs),
        "session": windows.get("session"),
        "weekly": windows.get("weekly"),
        "extras": extras,
        "probe": _probe_info(probes, started),
    }


def telegram_caption(result: dict) -> str:
    session = result.get("session") or {}
    weekly = result.get("weekly") or {}
    session_txt = _window_line(session)
    weekly_txt = _window_line(weekly)
    extras = result.get("extras") or {}
    org = extras.get("organizationName") or extras.get("organizationId") or "—"
    return (
        "🍪 <b>Valid Claude cookie</b>\n"
        f"Email: <code>{_html(result.get('email') or '—')}</code>\n"
        f"Plan: <b>{_html(result.get('planLabel') or 'Claude')}</b>\n"
        f"Name: {_html(result.get('name') or '—')}\n"
        f"Session 5h: {session_txt}\n"
        f"Weekly: {weekly_txt}\n"
        f"Org: {_html(str(org))}"
    )


def _window_line(window: dict) -> str:
    if not window:
        return "—"
    percent = window.get("percent")
    resets = window.get("resets")
    bits = []
    if percent is not None:
        bits.append(f"{percent}% used")
    if resets:
        bits.append(f"resets {resets}")
    return " · ".join(bits) if bits else "—"


def _html(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
