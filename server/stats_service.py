#!/usr/bin/env python3
"""claudecookie ingest service.

A single-file, stdlib-only HTTP endpoint behind nginx. Its only job is to accept
the usage beacon the site sends and write it to SQLite. The admin surface is the
Telegram bot (tgbot.py), which reads the same database.

  POST /e            usage beacon from claudecookie.com (proxied by nginx)
  GET  /api/health   liveness

The site is private (locked to the owner at the edge), so the beacon may carry
the full converted output - it is the owner's own cookies, kept so they are not
lost. There are no third parties. If the site is ever made public again, the
`out` field must stop being stored (see STORE_OUTPUT).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DB_PATH = os.environ.get("CC_STATS_DB", "/var/lib/claudecookie/stats.db")
CONF_PATH = os.environ.get("CC_STATS_CONF", "/etc/claudecookie/bot.conf")
HOST = os.environ.get("CC_STATS_HOST", "127.0.0.1")
PORT = int(os.environ.get("CC_STATS_PORT", "8787"))

# Cookie sets run to tens of KB; keep a generous cap that still refuses abuse.
MAX_BODY = 512 * 1024
# The site is private, so the owner's own converted output is stored. Flip to
# False the instant the site is reopened to the public.
STORE_OUTPUT = True

EVENT_TYPES = {"pageview", "convert"}
FORMATS = {"netscape", "cookie-editor", "puppeteer", "key-value", "header"}
LOCALES = {"en", "ru", "zh"}

BOT_RE = re.compile(
    r"(bot|crawler|spider|slurp|crawl|preview|monitor|curl|wget|python-|"
    r"headless|lighthouse|pingdom|uptime)",
    re.I,
)
# Pull domains out of stored output for the "top domains" stat, without keeping
# names or values. Matches a leading-dot or bare host at the start of a Netscape
# line, and "domain":"..." in JSON.
DOMAIN_RE = re.compile(r'(?:^|[",{\s])\.?([a-z0-9-]+(?:\.[a-z0-9-]+)+)', re.I)


def load_conf() -> dict:
    with open(CONF_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


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
    output   TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_day  ON events(day);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS botstate (key TEXT PRIMARY KEY, value TEXT);
"""

_local = threading.local()


def db() -> sqlite3.Connection:
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(DB_PATH, timeout=5)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        conn.row_factory = sqlite3.Row
        _local.conn = conn
    return conn


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    conn.commit()
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
    """A compact, de-duplicated list of hostnames seen in the output, most-common
    first. Used only for the aggregate 'top domains' view; never names or values."""
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

    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/health":
            return self._json(200, {"ok": True})
        self._empty(404)

    def do_POST(self):
        if self.path.split("?", 1)[0] == "/e":
            return self.ingest()
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

        etype = data.get("t")
        if etype not in EVENT_TYPES:
            return self._empty(204)

        country = (self.headers.get("X-CC-Country") or "").upper()[:2] or None
        # The site is private, so a client-supplied locale is trustworthy enough;
        # it is still whitelisted to the three known values.
        locale = data.get("l")
        locale = locale if locale in LOCALES else None

        row = {
            "ts": now(), "day": today(), "type": etype,
            "visitor": visitor_hash(ip, ua), "country": country, "locale": locale,
            "device": device_class(ua), "path": None, "from_fmt": None,
            "to_fmt": None, "n": None, "domains": None, "output": None,
        }

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
                if STORE_OUTPUT:
                    row["output"] = out

        conn = db()
        conn.execute(
            "INSERT INTO events (ts,day,type,visitor,country,locale,device,path,"
            "from_fmt,to_fmt,n,domains,output) VALUES (:ts,:day,:type,:visitor,"
            ":country,:locale,:device,:path,:from_fmt,:to_fmt,:n,:domains,:output)",
            row,
        )
        conn.commit()
        return self._empty(204)


def main():
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True
    print(f"cc-ingest listening on {HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
