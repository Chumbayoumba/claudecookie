#!/usr/bin/env python3
"""Inspect a Claude.ai session cookie: account, plan, 5h/weekly usage.

Used by the ingest service. HTTP is injectable so tests never touch the network.
Live session values are never written to logs.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
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
# Names we read back out of Set-Cookie to detect and keep-alive a rotated session.
SET_COOKIE_NAMES = ("sessionKey", "sessionKeyV3", "routingHint", "lastActiveOrg")

BOOTSTRAP_URL = "https://claude.ai/api/bootstrap"
USAGE_PATH = "/api/organizations/{org}/usage?include_utilization=true"
CHROME_IMPERSONATE = ("chrome150", "chrome146", "chrome136", "chrome131")

CONF_PATH_ENV = "CC_STATS_CONF"
DEFAULT_CONF_PATH = "/etc/claudecookie/bot.conf"

# Getter contract: (url, cookie, device_id) -> (status, body[, set_cookie]).
# set_cookie, when present, is a {name: value} dict parsed from the response.
HttpGet = Callable[..., tuple]
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


_NETSCAPE_HEADER_RE = re.compile(
    r"^#\s*(?:Netscape\s+HTTP\s+Cookie\s+File|HTTP\s+Cookie\s+File)", re.I | re.M
)
MAX_SETS = 20


def split_cookie_sets(raw: str) -> list[str]:
    """Split a paste of several *separate* cookie sets into one string per set.

    Mirrors lib/cookies/split.ts: conservative, so a single set (the common case)
    returns ``[raw]`` unchanged. Boundaries: concatenated JSON values, a repeated
    Netscape header, blank-line-separated blocks (each with real content), or one
    header string per line. Capped at MAX_SETS.
    """
    text = (raw or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return []

    if text[0] in "[{":
        values = _scan_top_level_json(text)
        return values[:MAX_SETS] if len(values) > 1 else [text]

    # Netscape dumps: split by a repeated `# Netscape` header or a repeated cookie
    # name (each dump's names restart) — robust to blank-line, header, newline and
    # glued separators. Only take it when it finds >1 dump.
    if _looks_netscape(text):
        by_name = _split_netscape_by_name(_GLUED_NETSCAPE_RE.sub(r"\1\n\2", text))
        if len(by_name) > 1:
            return by_name[:MAX_SETS]

    blocks = [b.strip() for b in re.split(r"\n[ \t]*\n+", text) if b.strip()]
    if len(blocks) > 1 and all(_has_content(b) for b in blocks):
        return blocks[:MAX_SETS]

    lines = [l.strip() for l in text.split("\n") if l.strip() and not l.strip().startswith("#")]
    if len(lines) > 1 and all(_HEADER_LINE_RE.match(l) for l in lines):
        return lines[:MAX_SETS]

    return [text]


_HEADER_LINE_RE = re.compile(
    r"^\s*(?:(?:set-)?cookie\s*:\s*)?[^=;,\s]+=[^;]*(?:;\s*[^=;,\s]+=[^;]*)*$", re.I
)


def _has_content(block: str) -> bool:
    return any(l.strip() and not l.strip().startswith("#") for l in block.split("\n"))


def _scan_top_level_json(text: str) -> list[str]:
    out: list[str] = []
    depth = 0
    start = -1
    in_string = False
    escaped = False
    for i, ch in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            if start == -1:
                start = i
        elif ch in "{[":
            if depth == 0:
                start = i
            depth += 1
        elif ch in "}]":
            depth -= 1
            if depth == 0 and start != -1:
                out.append(text[start : i + 1].strip())
                start = -1
            elif depth < 0:
                return []
        elif depth == 0 and start != -1 and not ch.isspace():
            return []
    return out if depth == 0 and not in_string else []


_GLUED_NETSCAPE_RE = re.compile(
    r"([^\n\t])((?:\.?[A-Za-z0-9][\w.-]*\.[A-Za-z]{2,})\t(?:TRUE|FALSE)\t)"
)
_BOOLS = {"TRUE", "FALSE", "true", "false"}


def _looks_netscape(text: str) -> bool:
    if _NETSCAPE_HEADER_RE.search(text):
        return True
    for line in text.split("\n"):
        s = line.strip()
        if s and not s.startswith("#") and len(s.split("\t")) >= 7:
            return True
    return False


def _netscape_name(line: str):
    body = line[len("#HttpOnly_"):] if line.startswith("#HttpOnly_") else line
    tabs = body.split("\t")
    if len(tabs) >= 7:
        return tabs[5].strip() or None
    sp = body.split()
    if len(sp) >= 7 and sp[1] in _BOOLS and sp[3] in _BOOLS:
        return sp[5].strip() or None
    return None


def _split_netscape_by_name(text: str) -> list[str]:
    groups: list[str] = []
    cur: list[str] = []
    seen: set[str] = set()

    def flush():
        nonlocal cur, seen
        if seen:
            groups.append("\n".join(cur).strip())
            cur = []
            seen = set()

    for line in text.split("\n"):
        s = line.strip()
        if not s:
            if cur:
                cur.append(line)
            continue
        if _NETSCAPE_HEADER_RE.match(s):
            flush()
            cur.append(line)
            continue
        if s.startswith("#"):
            if cur:
                cur.append(line)
            continue
        name = _netscape_name(s)
        if name and name in seen:
            flush()
        if name:
            seen.add(name)
        cur.append(line)
    if any(l.strip() for l in cur):
        groups.append("\n".join(cur).strip())
    return [g for g in groups if g]


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


def cookie_oneline(raw: str) -> str:
    """Collapse one stored cookie set to a single line for a combined dump.

    Claude sessions become a Cookie header. Anything else is kept, just flattened
    so one set cannot span several lines in the combined file.
    """
    text = (raw or "").strip()
    if not text:
        return ""
    try:
        return cookie_header(extract_fields(text))
    except CookieParseError:
        pass
    if text[:1] in "[{":
        try:
            return json.dumps(json.loads(text), ensure_ascii=False, separators=(",", ":"))
        except (ValueError, TypeError):
            pass
    return re.sub(r"\s+", " ", text).strip()


def _read_conf() -> dict:
    path = os.environ.get(CONF_PATH_ENV, DEFAULT_CONF_PATH)
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError, TypeError):
        return {}
    return data if isinstance(data, dict) else {}


def _conf_str(name: str, env: str) -> str | None:
    value = os.environ.get(env)
    if isinstance(value, str) and value.strip():
        return value.strip()
    value = _read_conf().get(name)
    return value.strip() if isinstance(value, str) and value.strip() else None


def _conf_bool(name: str, env: str) -> bool:
    value = os.environ.get(env)
    if value is None:
        value = _read_conf().get(name)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return False


def configured_proxy() -> str | None:
    raw = (os.environ.get("CC_CHECK_PROXY") or "").strip()
    if raw:
        return raw
    data = _read_conf()
    value = data.get("check_proxy") or data.get("CC_CHECK_PROXY") or ""
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def require_proxy() -> bool:
    """Safe-mode: when true, never hit Claude without a proxy.

    A valid session arriving from a bare datacenter IP is the biggest reason a
    cookie gets revoked, so this lets the operator refuse to check at all until a
    residential proxy/WARP is wired in.
    """
    return _conf_bool("require_proxy", "CC_REQUIRE_PROXY")


def _proxy_pool() -> list[str]:
    raw = os.environ.get("CC_CHECK_PROXY_POOL")
    if raw and raw.strip():
        return [x.strip() for x in re.split(r"[,\n]", raw) if x.strip()]
    value = _read_conf().get("check_proxy_pool")
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    if isinstance(value, str) and value.strip():
        return [x.strip() for x in re.split(r"[,\n]", value) if x.strip()]
    return []


def select_proxy(country: str | None = None, session_id: str | None = None) -> str | None:
    """Pick the outbound proxy for one check.

    Priority: a geo/sticky template -> a pool (sticky by session hash) -> the
    single ``check_proxy``. Matching the exit country to where the cookie was
    logged in and pinning it to the session id keeps the check's IP consistent.

    Template placeholders:
      ``{sid}``  per-session id (same cookie -> same exit IP).
      ``{cc}``   raw 2-letter country (may be empty); for providers that put the
                 country inline and always require it (e.g. IPRoyal password).
      ``{geo}``  DataImpulse country segment: ``__cr.<cc>`` when the country is a
                 valid 2-letter code, else empty (DataImpulse 503s on an empty or
                 unknown country, so we drop the segment and take any-country).
    """
    template = _conf_str("check_proxy_template", "CC_CHECK_PROXY_TEMPLATE")
    if template:
        cc = (country or "").strip().lower()
        sid = session_id or "default"
        geo = f"__cr.{cc}" if len(cc) == 2 and cc.isalpha() else ""
        try:
            return template.format(cc=cc, country=cc, sid=sid, session=sid, geo=geo)
        except (KeyError, IndexError, ValueError):
            return template
    pool = _proxy_pool()
    if pool:
        if session_id:
            idx = int(hashlib.sha256(session_id.encode()).hexdigest(), 16) % len(pool)
        else:
            idx = 0
        return pool[idx]
    return configured_proxy()


def egress_ok(country: str | None = None, session_id: str | None = None) -> bool:
    """False only when safe-mode is on and no proxy can be resolved."""
    if not require_proxy():
        return True
    return bool(select_proxy(country, session_id))


# IANA timezone -> ISO country. The browser timezone survives a VPN (a VPN moves
# the IP, not the OS clock), so it is a better hint for "where did this person log
# in" than the visitor IP. Misses fall back to the visitor IP country upstream.
_TZ_COUNTRY = {
    "Europe/Moscow": "RU", "Europe/Kaliningrad": "RU", "Europe/Samara": "RU",
    "Asia/Yekaterinburg": "RU", "Asia/Novosibirsk": "RU", "Asia/Krasnoyarsk": "RU",
    "Asia/Irkutsk": "RU", "Asia/Vladivostok": "RU", "Asia/Omsk": "RU",
    "Europe/Kyiv": "UA", "Europe/Kiev": "UA", "Europe/Minsk": "BY",
    "Asia/Almaty": "KZ", "Asia/Aqtobe": "KZ", "Asia/Tashkent": "UZ",
    "Asia/Baku": "AZ", "Asia/Yerevan": "AM", "Asia/Tbilisi": "GE", "Asia/Bishkek": "KG",
    "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Berlin": "DE",
    "Europe/Paris": "FR", "Europe/Madrid": "ES", "Europe/Rome": "IT",
    "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Zurich": "CH",
    "Europe/Vienna": "AT", "Europe/Warsaw": "PL", "Europe/Prague": "CZ",
    "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK",
    "Europe/Helsinki": "FI", "Europe/Lisbon": "PT", "Europe/Athens": "GR",
    "Europe/Bucharest": "RO", "Europe/Budapest": "HU", "Europe/Istanbul": "TR",
    "Europe/Sofia": "BG", "Europe/Belgrade": "RS", "Europe/Zagreb": "HR",
    "Europe/Bratislava": "SK", "Europe/Ljubljana": "SI", "Europe/Vilnius": "LT",
    "Europe/Riga": "LV", "Europe/Tallinn": "EE", "Europe/Chisinau": "MD",
    "America/New_York": "US", "America/Detroit": "US", "America/Chicago": "US",
    "America/Denver": "US", "America/Phoenix": "US", "America/Los_Angeles": "US",
    "America/Anchorage": "US", "Pacific/Honolulu": "US",
    "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA",
    "America/Winnipeg": "CA", "America/Mexico_City": "MX", "America/Sao_Paulo": "BR",
    "America/Argentina/Buenos_Aires": "AR", "America/Buenos_Aires": "AR",
    "America/Bogota": "CO", "America/Santiago": "CL", "America/Lima": "PE",
    "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Shanghai": "CN",
    "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW", "Asia/Singapore": "SG",
    "Asia/Bangkok": "TH", "Asia/Jakarta": "ID", "Asia/Manila": "PH",
    "Asia/Kuala_Lumpur": "MY", "Asia/Ho_Chi_Minh": "VN", "Asia/Saigon": "VN",
    "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Karachi": "PK",
    "Asia/Dhaka": "BD", "Asia/Dubai": "AE", "Asia/Riyadh": "SA",
    "Asia/Jerusalem": "IL", "Asia/Tel_Aviv": "IL", "Asia/Tehran": "IR", "Asia/Baghdad": "IQ",
    "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU",
    "Australia/Perth": "AU", "Pacific/Auckland": "NZ",
    "Africa/Cairo": "EG", "Africa/Johannesburg": "ZA", "Africa/Lagos": "NG",
    "Africa/Nairobi": "KE", "Africa/Casablanca": "MA",
}


def tz_to_country(tz: str | None) -> str | None:
    if not isinstance(tz, str):
        return None
    return _TZ_COUNTRY.get(tz.strip())


# ISO2 countries where Claude is available (snapshot of anthropic.com/supported-countries,
# 2026). Claude checks the IP country on every request and a session seen from an
# UNSUPPORTED country can be revoked outright, so the proxy exit must always be one of
# these. Notably absent: RU, CN, BY, IR, KP, CU, SY, VE, AF, MM, YE.
CLAUDE_SUPPORTED = frozenset({
    "ad", "ae", "ag", "al", "am", "ao", "ar", "at", "au", "az", "ba", "bb", "bd", "be", "bf", "bg",
    "bh", "bi", "bj", "bn", "bo", "br", "bs", "bt", "bw", "bz", "ca", "cf", "cg", "ch", "ci", "cl",
    "cm", "co", "cr", "cv", "cy", "cz", "de", "dj", "dk", "dm", "do", "dz", "ec", "ee", "eg", "er",
    "es", "et", "fi", "fj", "fm", "fr", "ga", "gb", "gd", "ge", "gh", "gm", "gn", "gq", "gr", "gt",
    "gw", "gy", "hn", "hr", "ht", "hu", "id", "ie", "il", "in", "iq", "is", "it", "jm", "jo", "jp",
    "ke", "kg", "kh", "ki", "km", "kn", "kr", "kw", "kz", "la", "lb", "lc", "li", "lk", "lr", "ls",
    "lt", "lu", "lv", "ly", "ma", "mc", "md", "me", "mg", "mh", "mk", "ml", "mn", "mr", "mt", "mu",
    "mv", "mw", "mx", "my", "mz", "na", "ne", "ng", "ni", "nl", "no", "np", "nr", "nz", "om", "pa",
    "pe", "pg", "ph", "pk", "pl", "ps", "pt", "pw", "py", "qa", "ro", "rs", "rw", "sa", "sb", "sc",
    "sd", "se", "sg", "si", "sk", "sl", "sm", "sn", "so", "sr", "ss", "st", "sv", "sz", "td", "tg",
    "th", "tj", "tl", "tm", "tn", "to", "tr", "tt", "tv", "tw", "tz", "ua", "ug", "us", "uy", "uz",
    "va", "vc", "vn", "vu", "ws", "za", "zm", "zw",
})


def default_country() -> str:
    """The neutral Claude-supported exit country for unknown/unsupported users."""
    cc = (_conf_str("check_default_cc", "CC_CHECK_DEFAULT_CC") or "us").lower()
    return cc if cc in CLAUDE_SUPPORTED else "us"


def resolve_country(tz: str | None = None, ip_country: str | None = None) -> str:
    """Pick a Claude-SUPPORTED exit country for the check.

    Take the user's own country (browser timezone first, then visitor IP) only when
    Claude supports it; otherwise fall back to the neutral default. Never returns an
    unsupported country (RU/CN/...), because egressing from one can revoke the session.
    """
    for candidate in (tz_to_country(tz), ip_country):
        cc = (candidate or "").strip().lower()
        if len(cc) == 2 and cc.isalpha() and cc in CLAUDE_SUPPORTED:
            return cc
    return default_country()


def _client_headers() -> dict[str, str]:
    """Headers a real claude.ai XHR carries. Platform/priority are stable; the
    exact client version/sha rotate, so we only send them when the operator has
    pinned them (from a fresh HAR) to avoid looking anomalous with stale values.
    """
    headers = {
        "anthropic-client-platform": "web_claude_ai",
        "priority": "u=1, i",
    }
    version = _conf_str("client_version", "CC_CLIENT_VERSION")
    if version:
        headers["anthropic-client-version"] = version
    sha = _conf_str("client_sha", "CC_CLIENT_SHA")
    if sha:
        headers["anthropic-client-sha"] = sha
    return headers


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
    headers.update(_client_headers())
    if device_id:
        headers["anthropic-device-id"] = device_id
    return headers


def default_http_get(
    url: str,
    cookie: str,
    device_id: str | None,
    *,
    country: str | None = None,
    session_id: str | None = None,
) -> tuple[int, Any, dict | None]:
    headers = _request_headers(url, cookie, device_id)
    proxy = select_proxy(country, session_id)
    try:
        from curl_cffi import requests as cf
    except ImportError:
        # Without a browser TLS fingerprint any request looks like a bot and can
        # burn the cookie, so refuse the egress instead of falling back to urllib.
        print("check ERROR curl_cffi unavailable; refusing insecure egress", flush=True)
        return 0, None, None
    return _curl_cffi_get(cf, url, headers, proxy)


def _proxy_map(proxy: str | None) -> dict[str, str] | None:
    if not proxy:
        return None
    return {"http": proxy, "https": proxy}


def _extract_set_cookie(resp: Any) -> dict[str, str]:
    out: dict[str, str] = {}
    try:
        jar = getattr(resp, "cookies", None)
        if jar is None:
            return {}
        for name in SET_COOKIE_NAMES:
            try:
                value = jar.get(name)
            except Exception:
                value = None
            if value:
                out[name] = str(value)
    except Exception:
        return {}
    return out


def _curl_cffi_get(
    cf: Any, url: str, headers: dict[str, str], proxy: str | None
) -> tuple[int, Any, dict | None]:
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
            return 0, None, None
        _working_impersonate = name
        return resp.status_code, _decode_body(resp.content), _extract_set_cookie(resp)
    return 0, None, None


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
    rotated = "yes" if result.get("rotated") else "no"
    return f"check {outcome} statuses={statuses} paths={paths} rotated={rotated} ms={ms}"


def session_key_hash(raw: str) -> str | None:
    """Stable per-session id (never the raw key) for locking, caching and sticky proxying."""
    try:
        fields = extract_fields(raw)
    except CookieParseError:
        return None
    key = fields.get("sessionKey") or fields.get("sessionKeyV3")
    if not key:
        return None
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _merge_refresh(refresh: dict, set_cookie: dict | None, original: dict) -> None:
    if not set_cookie:
        return
    for name, value in set_cookie.items():
        if value and name in SET_COOKIE_NAMES and value != original.get(name):
            refresh[name] = value


def _apply_refresh(raw: str, original: dict, refresh: dict) -> str | None:
    """Return the paste with rotated session tokens swapped in, preserving format.

    Only the long session tokens are rewritten (by value substitution, which works
    for JSON / Netscape / header pastes alike); short optional cookies are left be.
    """
    out = raw
    changed = False
    for name in SESSION_NAMES:
        new_value = refresh.get(name)
        old_value = original.get(name)
        if (
            new_value
            and old_value
            and len(old_value) >= 6
            and old_value != new_value
            and old_value in out
        ):
            out = out.replace(old_value, new_value)
            changed = True
    return out if changed else None


def check_cookie(
    raw: str,
    http_get: HttpGet | None = None,
    *,
    country: str | None = None,
    session_id: str | None = None,
) -> dict:
    started = time.monotonic()
    probes: list[dict[str, Any]] = []
    if http_get is None:
        def getter(url: str, cookie: str, device: str | None):
            return default_http_get(
                url, cookie, device, country=country, session_id=session_id
            )
    else:
        getter = http_get

    def call(url: str, cookie: str, device: str | None) -> tuple[int, Any, dict | None]:
        res = getter(url, cookie, device)
        if isinstance(res, tuple) and len(res) >= 3:
            return res[0], res[1], res[2]
        status, body = res
        return status, body, None

    try:
        fields = extract_fields(raw)
    except CookieParseError as exc:
        return _reject(str(exc) or "missing_session", probes, started)

    original_fields = dict(fields)
    refresh: dict[str, str] = {}
    header = cookie_header(fields)
    device = fields.get("anthropic-device-id")
    org_hint = fields.get("lastActiveOrg")

    status, body, set_cookie = call(BOOTSTRAP_URL, header, device)
    probes.append({"path": "bootstrap", "status": status})
    _merge_refresh(refresh, set_cookie, original_fields)
    if status in {401, 403}:
        return _reject("expired", probes, started)
    if status != 200 or body is None:
        return _reject("unreachable", probes, started)
    if not is_authenticated_payload(body):
        return _reject("expired", probes, started)

    # Keep-alive: if the session rotated on this call, carry the fresh token onward.
    if refresh:
        fields.update(refresh)
        header = cookie_header(fields)

    blobs: list[Any] = [body]
    windows: dict[str, dict] = {}
    for kind, window in pick_windows(body).items():
        windows.setdefault(kind, window)

    if "session" not in windows or "weekly" not in windows:
        org = org_hint or (org_ids_from(*blobs)[0] if org_ids_from(*blobs) else None)
        if org:
            usage_url = "https://claude.ai" + USAGE_PATH.format(org=org)
            status, usage, set_cookie = call(usage_url, header, device)
            probes.append({"path": "usage", "status": status})
            _merge_refresh(refresh, set_cookie, original_fields)
            if refresh:
                fields.update(refresh)
                header = cookie_header(fields)
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

    rotated = any(cookie_name in SESSION_NAMES for cookie_name in refresh)
    result = {
        "ok": True,
        "email": email,
        "name": name,
        "planLabel": plan_label(*blobs),
        "session": windows.get("session"),
        "weekly": windows.get("weekly"),
        "extras": extras,
        "rotated": rotated,
        "probe": _probe_info(probes, started),
    }
    if rotated:
        fresh = _apply_refresh(raw, original_fields, refresh)
        if fresh:
            # Internal only: the live cookie for keep-alive storage. Stripped from
            # the public JSON by public_check_result and never logged.
            result["freshCookie"] = fresh
    return result


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
