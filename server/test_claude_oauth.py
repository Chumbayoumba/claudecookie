#!/usr/bin/env python3
"""Cookie → credentials.json builder. HTTP is injected; no network."""

import io
import os
import unittest
from contextlib import redirect_stdout
from urllib.parse import urlparse

import claude_oauth as oauth


COOKIE = "sessionKey=sk-ant-sid02-TESTONLY; lastActiveOrg=org-1"


class ClaudeOauthTests(unittest.TestCase):
    def setUp(self) -> None:
        self._proxy = os.environ.get("CC_CHECK_PROXY")
        os.environ["CC_CHECK_PROXY"] = "socks5://127.0.0.1:1080"

    def tearDown(self) -> None:
        if self._proxy is None:
            os.environ.pop("CC_CHECK_PROXY", None)
        else:
            os.environ["CC_CHECK_PROXY"] = self._proxy

    def test_pkce_and_authorize_request(self) -> None:
        verifier, challenge, state = oauth.make_pkce()
        self.assertGreaterEqual(len(verifier), 43)
        self.assertTrue(state.isalnum())
        url, body = oauth.build_authorize_request(challenge, state, "org-1")
        parsed = urlparse(url)
        self.assertEqual(parsed.scheme, "https")
        self.assertEqual(parsed.netloc, "claude.ai")
        self.assertEqual(parsed.path, "/v1/oauth/org-1/authorize")
        self.assertEqual(body["client_id"], oauth.CLIENT_ID)
        self.assertEqual(body["code_challenge"], challenge)
        self.assertEqual(body["organization_uuid"], "org-1")
        self.assertEqual(body["response_type"], "code")
        self.assertEqual(body["code_challenge_method"], "S256")
        with self.assertRaises(oauth.ConvertError):
            oauth.build_authorize_request(challenge, state, "")

    def test_extract_code_from_location_and_hash(self) -> None:
        code, state = oauth.extract_authorization_code(
            "https://console.anthropic.com/oauth/code/callback?code=abc123#s1",
            None,
        )
        self.assertEqual(code, "abc123")
        self.assertEqual(state, "s1")
        code, state = oauth.extract_authorization_code(
            None, {"redirect_uri": "https://console.anthropic.com/oauth/code/callback?code=xyz"}
        )
        self.assertEqual(code, "xyz")

    def test_credentials_file_shape(self) -> None:
        file = oauth.build_credentials_file(
            {
                "access_token": "sk-ant-oat01-aaa",
                "refresh_token": "sk-ant-ort01-bbb",
                "expires_in": 3600,
                "scope": "user:inference user:profile",
            },
            "Claude Max",
        )
        oauth_block = file["claudeAiOauth"]
        self.assertEqual(oauth_block["accessToken"], "sk-ant-oat01-aaa")
        self.assertEqual(oauth_block["refreshToken"], "sk-ant-ort01-bbb")
        self.assertEqual(oauth_block["subscriptionType"], "max")
        self.assertGreater(oauth_block["expiresAt"], 1_000_000_000_000)

    def test_redact_hides_tokens(self) -> None:
        text = oauth.redact("got sk-ant-oat01-abcdefghijk and sessionKey=sk-ant-sid02-SECRET")
        self.assertNotIn("oat01-abcdefghijk", text)
        self.assertNotIn("sid02-SECRET", text)
        self.assertIn("[redacted]", text)

    def test_convert_session_injected_http(self) -> None:
        calls = []

        def http(method, url, cookie, device, json_body=None, extra_headers=None):
            calls.append((method, url, json_body, extra_headers))
            if "/v1/oauth/" in url and url.endswith("/authorize"):
                return (
                    200,
                    {"redirect_uri": "https://console.anthropic.com/oauth/code/callback?code=auth-code"},
                    None,
                    None,
                )
            if url.endswith("/oauth/token"):
                return (
                    200,
                    {
                        "access_token": "sk-ant-oat01-LIVE",
                        "refresh_token": "sk-ant-ort01-LIVE",
                        "expires_in": 120,
                    },
                    None,
                    None,
                )
            return 500, None, None, None

        buf = io.StringIO()
        with redirect_stdout(buf):
            payload = oauth.convert_session(
                COOKIE,
                country="us",
                session_id="sid",
                check_result={"planLabel": "Claude Pro", "extras": {"organizationId": "org-1"}},
                http_request=http,
            )
        log = buf.getvalue()
        self.assertNotIn("sk-ant-oat01-LIVE", log)
        self.assertNotIn("sk-ant-ort01-LIVE", log)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["filename"], ".credentials.json")
        self.assertEqual(payload["credentials"]["claudeAiOauth"]["accessToken"], "sk-ant-oat01-LIVE")
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0][0], "POST")
        self.assertIn("/v1/oauth/org-1/authorize", calls[0][1])
        self.assertEqual(calls[0][2]["organization_uuid"], "org-1")
        self.assertEqual(calls[0][3]["Referer"], "https://claude.ai/new")
        self.assertEqual(calls[1][0], "POST")
        self.assertEqual(calls[1][2]["grant_type"], "authorization_code")

    def test_convert_without_code_fails(self) -> None:
        def http(method, url, cookie, device, json_body=None, extra_headers=None):
            return 200, {"account": "ok"}, None, None

        with self.assertRaises(oauth.ConvertError) as ctx:
            oauth.convert_session(COOKIE, http_request=http)
        self.assertEqual(ctx.exception.reason, "convert_failed")

    def test_convert_fetches_org_when_missing(self) -> None:
        calls = []

        def http(method, url, cookie, device, json_body=None, extra_headers=None):
            calls.append((method, url))
            if url.endswith("/api/organizations"):
                return 200, [{"uuid": "org-fetched", "name": "Work"}], None, None
            if url.endswith("/v1/oauth/org-fetched/authorize"):
                return (
                    200,
                    {"redirect_uri": "https://console.anthropic.com/oauth/code/callback?code=z"},
                    None,
                    None,
                )
            if url.endswith("/oauth/token"):
                return (
                    200,
                    {"access_token": "sk-ant-oat01-x", "refresh_token": "sk-ant-ort01-y", "expires_in": 60},
                    None,
                    None,
                )
            return 500, None, None, None

        payload = oauth.convert_session(
            "sessionKey=sk-ant-sid02-TESTONLY",
            http_request=http,
        )
        self.assertTrue(payload["ok"])
        self.assertEqual(calls[0], ("GET", oauth.ORGANIZATIONS_URL))
        self.assertTrue(calls[1][1].endswith("/v1/oauth/org-fetched/authorize"))

    def test_authorize_forbidden_is_expired(self) -> None:
        def http(method, url, cookie, device, json_body=None, extra_headers=None):
            return 403, {"error": "no"}, None, None

        with self.assertRaises(oauth.ConvertError) as ctx:
            oauth.convert_session(COOKIE, http_request=http)
        self.assertEqual(ctx.exception.reason, "expired")


if __name__ == "__main__":
    unittest.main()
