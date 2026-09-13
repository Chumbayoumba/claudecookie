#!/usr/bin/env python3
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import claude_check as cc

NETSCAPE = """# Netscape HTTP Cookie File
.claude.ai	TRUE	/	TRUE	9999999999	CH-prefers-color-scheme	light
.claude.ai	TRUE	/	TRUE	9999999999	lastActiveOrg	org-aaa
.claude.ai	TRUE	/	TRUE	9999999999	routingHint	rh-test
.claude.ai	TRUE	/	TRUE	9999999999	sessionKey	sk-ant-sid02-TESTONLY
.claude.ai	TRUE	/	TRUE	9999999999	sessionKeyLC	123
.claude.ai	TRUE	/	TRUE	9999999999	sessionKeyV3	sk-ant-sid02-TESTONLY
.claude.ai	TRUE	/	TRUE	9999999999	anthropic-device-id	dev-1
"""

JSON_COOKIES = """[
  {"name": "sessionKey", "value": "sk-ant-sid02-JSON"},
  {"name": "lastActiveOrg", "value": "org-bbb"}
]
"""

BOOTSTRAP = {
    "account": {
        "email_address": "ada@example.com",
        "full_name": "Ada Lovelace",
        "display_name": "Ada",
        "memberships": [
            {
                "organization": {
                    "uuid": "org-aaa",
                    "name": "Ada's Organization",
                    "capabilities": ["chat", "claude_pro"],
                    "rate_limit_tier": "default_claude_ai",
                }
            }
        ],
    }
}

USAGE = {
    "utilization": {
        "five_hour": {
            "utilization": 0.10,
            "resets_at": "2099-01-01T15:00:00Z",
        },
        "seven_day": {
            "utilization": 0.29,
            "resets_at": "2099-01-06T00:00:00Z",
        },
    }
}


class ExtractTests(unittest.TestCase):
    def test_empty(self) -> None:
        with self.assertRaises(cc.CookieParseError) as ctx:
            cc.extract_fields("   \n")
        self.assertEqual(str(ctx.exception), "empty")

    def test_netscape(self) -> None:
        fields = cc.extract_fields(NETSCAPE)
        self.assertEqual(fields["sessionKey"], "sk-ant-sid02-TESTONLY")
        self.assertEqual(fields["lastActiveOrg"], "org-aaa")
        self.assertEqual(fields["anthropic-device-id"], "dev-1")

    def test_json(self) -> None:
        fields = cc.extract_fields(JSON_COOKIES)
        self.assertEqual(fields["sessionKey"], "sk-ant-sid02-JSON")
        self.assertEqual(fields["lastActiveOrg"], "org-bbb")

    def test_header(self) -> None:
        fields = cc.extract_fields("sessionKey=sk-ant-sid02-HDR; foo=bar")
        self.assertEqual(fields["sessionKey"], "sk-ant-sid02-HDR")

    def test_no_session(self) -> None:
        with self.assertRaises(cc.CookieParseError) as ctx:
            cc.extract_fields("foo=bar; baz=1")
        self.assertEqual(str(ctx.exception), "missing_session")

    def test_cookie_editor_json(self) -> None:
        # Cookie-Editor / EditThisCookie style: full cookie objects.
        text = """[
          {"domain": ".claude.ai", "name": "sessionKey", "value": "sk-CE",
           "path": "/", "secure": true, "httpOnly": true, "hostOnly": false},
          {"domain": ".claude.ai", "name": "lastActiveOrg", "value": "org-ce"}
        ]"""
        fields = cc.extract_fields(text)
        self.assertEqual(fields["sessionKey"], "sk-CE")
        self.assertEqual(fields["lastActiveOrg"], "org-ce")

    def test_puppeteer_json(self) -> None:
        # Puppeteer setCookie array uses the same name/value shape.
        text = '[{"name":"sessionKeyV3","value":"sk-PPT","domain":".claude.ai","expires":9999999999}]'
        fields = cc.extract_fields(text)
        self.assertEqual(fields["sessionKeyV3"], "sk-PPT")

    def test_json_data_wrapper(self) -> None:
        text = '{"data": [{"name": "sessionKey", "value": "sk-WRAP"}]}'
        fields = cc.extract_fields(text)
        self.assertEqual(fields["sessionKey"], "sk-WRAP")

    def test_header_v3_only(self) -> None:
        fields = cc.extract_fields("sessionKeyV3=sk-HDR3; lastActiveOrg=org-h")
        self.assertEqual(fields["sessionKeyV3"], "sk-HDR3")
        self.assertEqual(fields["lastActiveOrg"], "org-h")

    def test_cookie_header_sends_routing_hint(self) -> None:
        fields = cc.extract_fields(NETSCAPE)
        header = cc.cookie_header(fields)
        self.assertIn("sessionKey=sk-ant-sid02-TESTONLY", header)
        self.assertIn("routingHint=rh-test", header)
        self.assertIn("sessionKeyLC=123", header)
        self.assertIn("anthropic-device-id=dev-1", header)


class PlanTests(unittest.TestCase):
    def test_pro(self) -> None:
        self.assertEqual(cc.plan_label(BOOTSTRAP), "Claude Pro")

    def test_max_20(self) -> None:
        self.assertEqual(
            cc.plan_label({"capabilities": ["claude_max"], "rate_limit_tier": "max_20x"}),
            "Claude Max 20x",
        )

    def test_pro_5x(self) -> None:
        self.assertEqual(
            cc.plan_label({"subscriptionLabel": "Claude Pro 5x"}),
            "Claude Pro 5x",
        )


class WindowTests(unittest.TestCase):
    def test_pick_windows(self) -> None:
        windows = cc.pick_windows(USAGE)
        self.assertEqual(windows["session"]["percent"], 10)
        self.assertEqual(windows["weekly"]["percent"], 29)

    def test_resets_in_hours(self) -> None:
        now = datetime(2099, 1, 1, 12, 0, tzinfo=timezone.utc)
        self.assertEqual(cc.resets_in("2099-01-01T15:00:00Z", now=now), "3h")

    def test_resets_in_days(self) -> None:
        now = datetime(2099, 1, 1, 0, 0, tzinfo=timezone.utc)
        self.assertEqual(cc.resets_in("2099-01-06T00:00:00Z", now=now), "5d")


class CheckTests(unittest.TestCase):
    def test_missing_session(self) -> None:
        result = cc.check_cookie("not a cookie")
        self.assertFalse(result["ok"])
        self.assertEqual(result["invalidReason"], "missing_session")

    def test_empty(self) -> None:
        result = cc.check_cookie("")
        self.assertFalse(result["ok"])
        self.assertEqual(result["invalidReason"], "empty")

    def test_valid(self) -> None:
        calls: list[str] = []

        def fake(url: str, cookie: str, device: str | None):
            calls.append(url)
            self.assertIn("sessionKey=sk-ant-sid02-TESTONLY", cookie)
            self.assertIn("routingHint=rh-test", cookie)
            if url.endswith("/api/bootstrap"):
                return 200, BOOTSTRAP
            if "/usage" in url:
                self.assertIn("include_utilization=true", url)
                return 200, USAGE
            self.fail(f"unexpected url {url}")

        result = cc.check_cookie(NETSCAPE, http_get=fake)
        self.assertTrue(result["ok"])
        self.assertEqual(result["email"], "ada@example.com")
        self.assertEqual(result["name"], "Ada Lovelace")
        self.assertEqual(result["planLabel"], "Claude Pro")
        self.assertEqual(result["session"]["percent"], 10)
        self.assertEqual(result["weekly"]["percent"], 29)
        self.assertNotIn("sessionKey", str(result.get("extras")))
        self.assertEqual(len(calls), 2)
        self.assertEqual(result["probe"]["paths"], ["bootstrap", "usage"])
        self.assertEqual(result["probe"]["statuses"], [200, 200])
        line = cc.format_check_log(result)
        self.assertIn("check valid", line)
        self.assertIn("paths=bootstrap,usage", line)
        self.assertNotIn("sessionKey", line)
        self.assertNotIn("sk-ant", line)

    def test_skips_usage_when_windows_present(self) -> None:
        calls: list[str] = []
        body = dict(BOOTSTRAP)
        body["utilization"] = USAGE["utilization"]

        def fake(url: str, cookie: str, device: str | None):
            calls.append(url)
            if url.endswith("/api/bootstrap"):
                return 200, body
            self.fail(f"usage should not be called: {url}")

        result = cc.check_cookie(NETSCAPE, http_get=fake)
        self.assertTrue(result["ok"])
        self.assertEqual(len(calls), 1)
        self.assertEqual(result["session"]["percent"], 10)
        self.assertEqual(result["probe"]["paths"], ["bootstrap"])

    def test_public_bootstrap_is_not_valid(self) -> None:
        calls: list[str] = []

        def fake(url: str, cookie: str, device: str | None):
            calls.append(url)
            if url.endswith("/api/bootstrap"):
                return 200, {"account": None, "statsig": {}, "growthbook": {}}
            self.fail(f"should stop after public bootstrap: {url}")

        result = cc.check_cookie(NETSCAPE, http_get=fake)
        self.assertFalse(result["ok"])
        self.assertEqual(result["invalidReason"], "expired")
        self.assertEqual(len(calls), 1)

    def test_expired_stops_after_first_401(self) -> None:
        calls: list[str] = []

        def fake(url: str, cookie: str, device: str | None):
            calls.append(url)
            return 401, {"error": "unauthorized"}

        result = cc.check_cookie(NETSCAPE, http_get=fake)
        self.assertFalse(result["ok"])
        self.assertEqual(result["invalidReason"], "expired")
        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0].endswith("/api/bootstrap"))
        self.assertNotIn("edge-api", calls[0])
        self.assertEqual(result["probe"]["statuses"], [401])
        self.assertEqual(result["probe"]["paths"], ["bootstrap"])

    def test_forbidden_stops_after_first_403(self) -> None:
        calls: list[str] = []

        def fake(url: str, cookie: str, device: str | None):
            calls.append(url)
            return 403, {"error": "forbidden"}

        result = cc.check_cookie(NETSCAPE, http_get=fake)
        self.assertFalse(result["ok"])
        self.assertEqual(result["invalidReason"], "expired")
        self.assertEqual(len(calls), 1)
        self.assertEqual(result["probe"]["statuses"], [403])

    def test_configured_proxy_reads_env(self) -> None:
        previous = os.environ.get("CC_CHECK_PROXY")
        os.environ["CC_CHECK_PROXY"] = "socks5://user:pass@127.0.0.1:1080"
        try:
            self.assertEqual(cc.configured_proxy(), "socks5://user:pass@127.0.0.1:1080")
        finally:
            if previous is None:
                os.environ.pop("CC_CHECK_PROXY", None)
            else:
                os.environ["CC_CHECK_PROXY"] = previous

    def test_configured_proxy_reads_bot_conf(self) -> None:
        previous_env = os.environ.get("CC_CHECK_PROXY")
        previous_conf = os.environ.get("CC_STATS_CONF")
        os.environ.pop("CC_CHECK_PROXY", None)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bot.conf"
            path.write_text('{"check_proxy": "http://127.0.0.1:8080"}', encoding="utf-8")
            os.environ["CC_STATS_CONF"] = str(path)
            try:
                self.assertEqual(cc.configured_proxy(), "http://127.0.0.1:8080")
            finally:
                if previous_env is None:
                    os.environ.pop("CC_CHECK_PROXY", None)
                else:
                    os.environ["CC_CHECK_PROXY"] = previous_env
                if previous_conf is None:
                    os.environ.pop("CC_STATS_CONF", None)
                else:
                    os.environ["CC_STATS_CONF"] = previous_conf


if __name__ == "__main__":
    unittest.main()
