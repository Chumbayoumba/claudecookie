#!/usr/bin/env python3
"""Bot views, zip builder, and push filters. Does not talk to Telegram."""

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
        self.assertIn("валидных", txt)

    def test_should_push_check(self) -> None:
        settings = {"push_check_valid": "1", "push_check_invalid": "0"}
        get = lambda k, d="1": settings.get(k, d)
        self.assertTrue(self.bot.should_push_check(1, get))
        self.assertFalse(self.bot.should_push_check(0, get))

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


if __name__ == "__main__":
    unittest.main()
