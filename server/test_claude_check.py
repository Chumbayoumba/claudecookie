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

    def test_cookie_oneline_flattens_netscape(self) -> None:
        line = cc.cookie_oneline(NETSCAPE)
        self.assertNotIn("\n", line)
        self.assertIn("sessionKey=sk-ant-sid02-TESTONLY", line)
        self.assertIn("lastActiveOrg=org-aaa", line)
        self.assertIn("routingHint=rh-test", line)

    def test_cookie_oneline_keeps_non_claude(self) -> None:
        self.assertEqual(cc.cookie_oneline("foo=bar;\nbaz=1"), "foo=bar; baz=1")
        self.assertEqual(
            cc.cookie_oneline('[{"name":"other","value":"x"}]'),
            '[{"name":"other","value":"x"}]',
        )

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

    def test_cookie_editor_httponly_netscape(self) -> None:
        text = (
            "# Netscape HTTP Cookie File\n"
            "#HttpOnly_.claude.ai\tTRUE\t/\tTRUE\t9999999999\tsessionKey\tsk-ant-sid02-HTTPONLY\n"
            "# this is a comment with sessionKey\tskipped\n"
            ".claude.ai\tTRUE\t/\tTRUE\t9999999999\tlastActiveOrg\torg-ho\n"
        )
        fields = cc.extract_fields(text)
        self.assertEqual(fields["sessionKey"], "sk-ant-sid02-HTTPONLY")
        self.assertEqual(fields["lastActiveOrg"], "org-ho")
        self.assertEqual(cc.session_auth_header(fields), "sessionKey=sk-ant-sid02-HTTPONLY")
        self.assertTrue(
            cc._has_content(
                "# Netscape HTTP Cookie File\n"
                "#HttpOnly_.claude.ai\tTRUE\t/\tTRUE\t1\tsessionKey\tsk-ant-sid02-HTTPONLY"
            )
        )

    def test_session_auth_header_is_one_key(self) -> None:
        fields = cc.extract_fields(NETSCAPE)
        self.assertEqual(cc.session_auth_header(fields), "sessionKey=sk-ant-sid02-TESTONLY")
        self.assertEqual(
            cc.session_auth_header({"sessionKeyV3": "sk-v3-only"}),
            "sessionKeyV3=sk-v3-only",
        )


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


ROT_COOKIE = "sessionKey=sk-ant-OLD; sessionKeyV3=sk-v3-OLD; lastActiveOrg=org-aaa; routingHint=rh"


class RotationTests(unittest.TestCase):
    def test_rotation_keep_alive(self) -> None:
        calls: list[str] = []

        def fake(url: str, cookie: str, device: str | None):
            calls.append(url)
            if url.endswith("/api/bootstrap"):
                # bootstrap rotates the session key via Set-Cookie
                return 200, BOOTSTRAP, {"sessionKey": "sk-ant-NEW"}
            if "/usage" in url:
                # the fresh token must be carried onto the usage call
                self.assertIn("sessionKey=sk-ant-NEW", cookie)
                self.assertIn("sessionKeyV3=sk-v3-OLD", cookie)
                return 200, USAGE, None
            self.fail(f"unexpected url {url}")

        result = cc.check_cookie(ROT_COOKIE, http_get=fake)
        self.assertTrue(result["ok"])
        self.assertTrue(result["rotated"])
        self.assertIn("sk-ant-NEW", result["freshCookie"])
        self.assertNotIn("sk-ant-OLD", result["freshCookie"])
        line = cc.format_check_log(result)
        self.assertIn("rotated=yes", line)
        self.assertNotIn("sk-ant-NEW", line)

    def test_no_rotation_no_fresh_cookie(self) -> None:
        def fake(url: str, cookie: str, device: str | None):
            if url.endswith("/api/bootstrap"):
                return 200, BOOTSTRAP, None
            return 200, USAGE, None

        result = cc.check_cookie(NETSCAPE, http_get=fake)
        self.assertTrue(result["ok"])
        self.assertFalse(result["rotated"])
        self.assertNotIn("freshCookie", result)
        self.assertIn("rotated=no", cc.format_check_log(result))

    def test_two_tuple_getter_still_works(self) -> None:
        def fake(url: str, cookie: str, device: str | None):
            if url.endswith("/api/bootstrap"):
                return 200, BOOTSTRAP
            return 200, USAGE

        result = cc.check_cookie(NETSCAPE, http_get=fake)
        self.assertTrue(result["ok"])
        self.assertFalse(result["rotated"])

    def test_unreachable_on_zero_status(self) -> None:
        result = cc.check_cookie(NETSCAPE, http_get=lambda u, c, d: (0, None))
        self.assertFalse(result["ok"])
        self.assertEqual(result["invalidReason"], "unreachable")


class EgressTests(unittest.TestCase):
    def setUp(self) -> None:
        self._saved = {
            k: os.environ.get(k)
            for k in (
                "CC_REQUIRE_PROXY", "CC_CHECK_PROXY", "CC_CHECK_PROXY_POOL",
                "CC_CHECK_PROXY_TEMPLATE", "CC_STATS_CONF",
            )
        }
        for k in self._saved:
            os.environ.pop(k, None)
        os.environ["CC_STATS_CONF"] = "/nonexistent/claudecookie/bot.conf"

    def tearDown(self) -> None:
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_egress_ok_when_not_required(self) -> None:
        self.assertTrue(cc.egress_ok())

    def test_require_proxy_blocks_without_proxy(self) -> None:
        os.environ["CC_REQUIRE_PROXY"] = "1"
        self.assertFalse(cc.egress_ok("DE", "sid"))
        os.environ["CC_CHECK_PROXY"] = "socks5://127.0.0.1:1080"
        self.assertTrue(cc.egress_ok("DE", "sid"))

    def test_select_proxy_template_geo_sticky(self) -> None:
        os.environ["CC_CHECK_PROXY_TEMPLATE"] = "http://u-country-{cc}-session-{sid}:p@gw:1080"
        got = cc.select_proxy("DE", "abc123")
        self.assertIn("country-de", got)
        self.assertIn("session-abc123", got)

    def test_select_proxy_pool_is_sticky(self) -> None:
        os.environ["CC_CHECK_PROXY_POOL"] = "http://a:1,http://b:2,http://c:3"
        one = cc.select_proxy(None, "sess-1")
        two = cc.select_proxy(None, "sess-1")
        self.assertEqual(one, two)
        self.assertIn(one, ["http://a:1", "http://b:2", "http://c:3"])

    def test_geo_segment_included_for_valid_country(self) -> None:
        os.environ["CC_CHECK_PROXY_TEMPLATE"] = "http://LOGIN{geo}__sessid.{sid}:PASS@gw:823"
        got = cc.select_proxy("RU", "abcd1234")
        self.assertEqual(got, "http://LOGIN__cr.ru__sessid.abcd1234:PASS@gw:823")

    def test_geo_segment_dropped_when_country_unknown(self) -> None:
        # DataImpulse 503s on an empty country, so the segment must vanish, not
        # become "__cr.".
        os.environ["CC_CHECK_PROXY_TEMPLATE"] = "http://LOGIN{geo}__sessid.{sid}:PASS@gw:823"
        got = cc.select_proxy(None, "abcd1234")
        self.assertEqual(got, "http://LOGIN__sessid.abcd1234:PASS@gw:823")
        self.assertNotIn("__cr.", got)


class MiscTests(unittest.TestCase):
    def test_session_key_hash_stable(self) -> None:
        h1 = cc.session_key_hash("sessionKey=sk-ant-abc")
        h2 = cc.session_key_hash("sessionKey=sk-ant-abc; foo=1")
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 16)
        self.assertIsNone(cc.session_key_hash("no session here"))

    def test_request_headers_look_like_browser_xhr(self) -> None:
        headers = cc._request_headers("https://claude.ai/api/bootstrap", "sessionKey=x", None)
        self.assertEqual(headers["anthropic-client-platform"], "web_claude_ai")
        self.assertIn("priority", headers)
        self.assertEqual(headers["Origin"], "https://claude.ai")
        self.assertEqual(headers["Cookie"], "sessionKey=x")
        token = cc._request_headers("https://platform.claude.com/v1/oauth/token", "", None)
        self.assertEqual(token["Origin"], "https://platform.claude.com")
        self.assertNotIn("Cookie", token)

    def test_tz_to_country(self) -> None:
        self.assertEqual(cc.tz_to_country("Europe/Moscow"), "RU")
        self.assertEqual(cc.tz_to_country("America/New_York"), "US")
        self.assertEqual(cc.tz_to_country("Europe/Kyiv"), "UA")
        self.assertIsNone(cc.tz_to_country("Mars/Phobos"))
        self.assertIsNone(cc.tz_to_country(None))


class GeoCountryTests(unittest.TestCase):
    def setUp(self) -> None:
        self._saved = {k: os.environ.get(k) for k in ("CC_CHECK_DEFAULT_CC", "CC_STATS_CONF")}
        os.environ.pop("CC_CHECK_DEFAULT_CC", None)
        os.environ["CC_STATS_CONF"] = "/nonexistent/bot.conf"

    def tearDown(self) -> None:
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_supported_set_excludes_blocked_countries(self) -> None:
        for code in ("ru", "cn", "by", "ir", "kp", "cu", "sy", "ve", "af", "mm", "ye"):
            self.assertNotIn(code, cc.CLAUDE_SUPPORTED)
        for code in ("us", "ua", "kz", "de", "gb", "ge", "am", "az", "uz"):
            self.assertIn(code, cc.CLAUDE_SUPPORTED)

    def test_default_country_is_us(self) -> None:
        self.assertEqual(cc.default_country(), "us")

    def test_default_country_override(self) -> None:
        os.environ["CC_CHECK_DEFAULT_CC"] = "de"
        self.assertEqual(cc.default_country(), "de")

    def test_default_country_invalid_override_falls_back(self) -> None:
        os.environ["CC_CHECK_DEFAULT_CC"] = "ru"  # unsupported -> us
        self.assertEqual(cc.default_country(), "us")

    def test_resolve_supported_user_country(self) -> None:
        self.assertEqual(cc.resolve_country("Europe/Kyiv", None), "ua")
        self.assertEqual(cc.resolve_country(None, "DE"), "de")

    def test_resolve_blocked_country_uses_neutral(self) -> None:
        # Moscow tz -> RU, and even a RU visitor IP -> both unsupported -> neutral us
        self.assertEqual(cc.resolve_country("Europe/Moscow", "RU"), "us")
        self.assertEqual(cc.resolve_country("Asia/Shanghai", "CN"), "us")

    def test_resolve_unknown_uses_neutral(self) -> None:
        self.assertEqual(cc.resolve_country("Mars/Phobos", None), "us")
        self.assertEqual(cc.resolve_country(None, None), "us")


class SplitCookieSetsTest(unittest.TestCase):
    CE = '[{"name":"sessionKey","value":"a","expirationDate":1,"domain":".claude.ai"}]'
    HDR = "sessionKey=aaa; lastActiveOrg=x"

    def test_empty(self) -> None:
        self.assertEqual(cc.split_cookie_sets(""), [])
        self.assertEqual(cc.split_cookie_sets("  \n "), [])

    def test_single_stays_one(self) -> None:
        self.assertEqual(len(cc.split_cookie_sets(self.CE)), 1)
        self.assertEqual(len(cc.split_cookie_sets(NETSCAPE)), 1)
        self.assertEqual(len(cc.split_cookie_sets(self.HDR)), 1)

    def test_concatenated_json(self) -> None:
        self.assertEqual(len(cc.split_cookie_sets(self.CE + "\n" + self.CE)), 2)
        self.assertEqual(len(cc.split_cookie_sets(self.CE + self.CE)), 2)

    def test_repeated_netscape_header(self) -> None:
        self.assertEqual(len(cc.split_cookie_sets(NETSCAPE + "\n\n" + NETSCAPE)), 2)

    def test_header_lines(self) -> None:
        self.assertEqual(len(cc.split_cookie_sets(self.HDR + "\n" + self.HDR + "\n" + self.HDR)), 3)

    def test_cap(self) -> None:
        many = "\n".join([self.HDR] * 50)
        self.assertEqual(len(cc.split_cookie_sets(many)), cc.MAX_SETS)

    def test_each_set_is_checkable(self) -> None:
        # Every split of a two-set paste extracts a session — proves the boundaries are clean.
        sets = cc.split_cookie_sets(self.CE + "\n" + self.CE)
        for s in sets:
            self.assertIn("sessionKey", cc.extract_fields(s))


if __name__ == "__main__":
    unittest.main()
