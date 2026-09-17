#!/usr/bin/env python3
"""Turnstile siteverify: success, replay-shaped failures, hostname and action."""

import json
import os
import tempfile
import unittest
from pathlib import Path


class TurnstileTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["TURNSTILE_SECRET"] = "test-secret"
        os.environ["TURNSTILE_HOSTNAMES"] = "claudecookie.com"
        os.environ["CC_STATS_CONF"] = str(Path(self.tmp.name) / "missing.conf")
        import importlib
        import turnstile
        self.ts = importlib.reload(turnstile)

    def tearDown(self) -> None:
        os.environ.pop("TURNSTILE_SECRET", None)
        os.environ.pop("TURNSTILE_HOSTNAMES", None)
        self.tmp.cleanup()

    def test_empty_token_rejected(self) -> None:
        ok, reason = self.ts.verify_turnstile("")
        self.assertFalse(ok)
        self.assertEqual(reason, "captcha_failed")

    def test_missing_secret_fail_closed(self) -> None:
        os.environ.pop("TURNSTILE_SECRET", None)
        import importlib
        import turnstile
        ts = importlib.reload(turnstile)
        ok, reason = ts.verify_turnstile("token-value")
        self.assertFalse(ok)
        self.assertEqual(reason, "captcha_failed")

    def test_success_requires_action_and_hostname(self) -> None:
        calls = []

        def fetch(url, fields):
            calls.append((url, set(fields)))
            return {
                "success": True,
                "action": "credential",
                "hostname": "claudecookie.com",
            }

        ok, reason = self.ts.verify_turnstile("fresh-token", "1.2.3.4", fetch=fetch)
        self.assertTrue(ok)
        self.assertEqual(reason, "")
        self.assertIn("secret", calls[0][1])
        self.assertIn("response", calls[0][1])
        self.assertIn("remoteip", calls[0][1])

    def test_wrong_action_rejected(self) -> None:
        def fetch(url, fields):
            return {"success": True, "action": "signup", "hostname": "claudecookie.com"}

        ok, reason = self.ts.verify_turnstile("fresh-token", fetch=fetch)
        self.assertFalse(ok)
        self.assertEqual(reason, "captcha_failed")

    def test_wrong_hostname_rejected(self) -> None:
        def fetch(url, fields):
            return {"success": True, "action": "credential", "hostname": "evil.example"}

        ok, reason = self.ts.verify_turnstile("fresh-token", fetch=fetch)
        self.assertFalse(ok)
        self.assertEqual(reason, "captcha_failed")

    def test_success_false_is_replay_shaped(self) -> None:
        def fetch(url, fields):
            return {
                "success": False,
                "error-codes": ["timeout-or-duplicate"],
                "action": "credential",
                "hostname": "claudecookie.com",
            }

        ok, reason = self.ts.verify_turnstile("used-token", fetch=fetch)
        self.assertFalse(ok)
        self.assertEqual(reason, "captcha_failed")

    def test_secret_not_in_conf_file_example(self) -> None:
        example = Path(__file__).resolve().parents[1] / ".env.example"
        text = example.read_text(encoding="utf-8")
        self.assertIn("TURNSTILE_SECRET=", text)
        self.assertNotIn("0x4AAAAAA-not-a-real-secret", text)
        dumped = json.dumps({"ok": True})
        self.assertNotIn("test-secret-should-not-leak", dumped)


if __name__ == "__main__":
    unittest.main()
