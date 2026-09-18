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
        self.assertEqual(parsed.netloc, "platform.claude.com")
        self.assertEqual(parsed.path, "/v1/oauth/org-1/authorize")
        legacy, _body = oauth.build_authorize_request(
            challenge, state, "org-1", authorize_url=oauth.LEGACY_AUTHORIZE_API
        )
        self.assertEqual(urlparse(legacy).netloc, "claude.ai")
        self.assertEqual(body["client_id"], oauth.CLIENT_ID)
        self.assertEqual(body["code_challenge"], challenge)
        self.assertEqual(body["organization_uuid"], "org-1")
        self.assertEqual(body["response_type"], "code")
        self.assertEqual(body["code_challenge_method"], "S256")
        self.assertEqual(body["redirect_uri"], oauth.REDIRECT_URI)
        self.assertIn("user:sessions:claude_code", body["scope"])
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

    def test_credentials_file_requires_refresh(self) -> None:
        with self.assertRaises(oauth.ConvertError) as ctx:
            oauth.build_credentials_file({"access_token": "sk-ant-oat01-aaa", "expires_in": 60})
        self.assertEqual(ctx.exception.reason, "no_refresh")

    def test_redact_hides_tokens(self) -> None:
        text = oauth.redact("got sk-ant-oat01-abcdefghijk and sessionKey=sk-ant-sid02-SECRET")
        self.assertNotIn("oat01-abcdefghijk", text)
        self.assertNotIn("sid02-SECRET", text)
        self.assertIn("[redacted]", text)

    def test_convert_session_injected_http(self) -> None:
        calls = []

        def http(method, url, cookie, device, json_body=None, extra_headers=None):
            calls.append((method, url, json_body, extra_headers, cookie))
            if url.endswith("/api/organizations"):
                return 200, [{"uuid": "org-1", "name": "Work"}], None, None
            if "/v1/oauth/" in url and url.endswith("/authorize"):
                return (
                    200,
                    {"redirect_uri": "https://platform.claude.com/oauth/code/callback?code=auth-code"},
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
        self.assertEqual(payload["credentials"]["claudeAiOauth"]["refreshToken"], "sk-ant-ort01-LIVE")
        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[0][0], "GET")
        self.assertTrue(calls[0][1].endswith("/api/organizations"))
        self.assertEqual(calls[1][0], "POST")
        self.assertEqual(calls[1][1], "https://platform.claude.com/v1/oauth/org-1/authorize")
        self.assertEqual(calls[1][2]["organization_uuid"], "org-1")
        self.assertEqual(calls[1][2]["redirect_uri"], oauth.REDIRECT_URI)
        self.assertEqual(calls[1][3]["Origin"], "https://claude.com")
        self.assertEqual(calls[1][3]["Referer"], "https://claude.com/cai/oauth/authorize?code=true")
        self.assertEqual(calls[1][4], "sessionKey=sk-ant-sid02-TESTONLY")
        self.assertEqual(calls[2][0], "POST")
        self.assertEqual(calls[2][1], oauth.TOKEN_URL)
        self.assertEqual(calls[2][2]["grant_type"], "authorization_code")
        self.assertEqual(calls[2][3]["Origin"], "https://claude.com")
        self.assertEqual(calls[2][4], "")

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
        self.assertEqual(calls[1][1], "https://platform.claude.com/v1/oauth/org-fetched/authorize")

    def test_token_falls_back_to_api_anthropic(self) -> None:
        urls = []

        def http(method, url, cookie, device, json_body=None, extra_headers=None):
            urls.append(url)
            if url.endswith("/api/organizations"):
                return 200, [{"uuid": "org-1"}], None, None
            if url.endswith("/authorize"):
                return (
                    200,
                    {"redirect_uri": "https://platform.claude.com/oauth/code/callback?code=z"},
                    None,
                    None,
                )
            if url == oauth.TOKEN_URL:
                return 500, {"error": "upstream"}, None, None
            if url == oauth.API_TOKEN_URL:
                return (
                    200,
                    {
                        "access_token": "sk-ant-oat01-x",
                        "refresh_token": "sk-ant-ort01-y",
                        "expires_in": 60,
                    },
                    None,
                    None,
                )
            return 500, None, None, None

        payload = oauth.convert_session(COOKIE, http_request=http)
        self.assertTrue(payload["ok"])
        self.assertIn(oauth.API_TOKEN_URL, urls)

    def test_stale_elevated_grant_retries_inference_scope(self) -> None:
        scopes = []

        def http(method, url, cookie, device, json_body=None, extra_headers=None):
            if url.endswith("/api/organizations"):
                return 200, [{"uuid": "org-1", "name": "Work", "raven_type": "team"}], None, None
            if url.endswith("/authorize"):
                scopes.append(json_body["scope"])
                if "claude_code" in json_body["scope"]:
                    return (
                        403,
                        {
                            "error": {
                                "type": "permission_error",
                                "message": "Session is not fresh enough to grant elevated access. Sign in again to continue.",
                                "details": {"error_code": "session_stale_relogin"},
                            }
                        },
                        None,
                        None,
                    )
                return (
                    200,
                    {"redirect_uri": "https://platform.claude.com/oauth/code/callback?code=z"},
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

        payload = oauth.convert_session(COOKIE, http_request=http)
        self.assertTrue(payload["ok"])
        self.assertIn("user:sessions:claude_code", scopes[0])
        self.assertEqual(scopes[1], oauth.SCOPE_INFERENCE)

    def test_pick_org_prefers_team(self) -> None:
        self.assertEqual(
            oauth.pick_org_uuid(
                [
                    {"uuid": "org-personal", "name": "Me"},
                    {"uuid": "org-team", "name": "Work", "raven_type": "team"},
                ]
            ),
            "org-team",
        )

    def test_stale_on_all_scopes_is_reauth(self) -> None:
        def http(method, url, cookie, device, json_body=None, extra_headers=None):
            if url.endswith("/api/organizations"):
                return 200, [{"uuid": "org-1"}], None, None
            if url.endswith("/authorize"):
                return (
                    403,
                    {
                        "error": {
                            "type": "permission_error",
                            "message": "Session is not fresh enough to grant elevated access. Sign in again to continue.",
                            "details": {"error_code": "session_stale_relogin"},
                        }
                    },
                    None,
                    None,
                )
            return 500, None, None, None

        with self.assertRaises(oauth.ConvertError) as ctx:
            oauth.convert_session(COOKIE, http_request=http)
        self.assertEqual(ctx.exception.reason, "reauth")

    def test_authorize_forbidden_is_expired(self) -> None:
        def http(method, url, cookie, device, json_body=None, extra_headers=None):
            return 403, {"error": "no"}, None, None

        with self.assertRaises(oauth.ConvertError) as ctx:
            oauth.convert_session(COOKIE, http_request=http)
        self.assertEqual(ctx.exception.reason, "expired")

    def test_free_plan_permission_error_is_no_plan(self) -> None:
        def http(method, url, cookie, device, json_body=None, extra_headers=None):
            if url.endswith("/api/organizations"):
                return 200, [{"uuid": "org-1", "name": "Me"}], None, None
            return (
                403,
                {
                    "error": {
                        "type": "permission_error",
                        "message": "Claude Code requires a Pro or Max subscription.",
                    }
                },
                None,
                None,
            )

        with self.assertRaises(oauth.ConvertError) as ctx:
            oauth.convert_session(
                COOKIE,
                http_request=http,
                check_result={"planLabel": "Claude Free"},
            )
        self.assertEqual(ctx.exception.reason, "no_plan")

    def test_permission_error_without_free_plan_stays_expired(self) -> None:
        def http(method, url, cookie, device, json_body=None, extra_headers=None):
            if url.endswith("/api/organizations"):
                return 200, [{"uuid": "org-1"}], None, None
            return 403, {"error": {"type": "permission_error", "message": "no"}}, None, None

        with self.assertRaises(oauth.ConvertError) as ctx:
            oauth.convert_session(
                COOKIE,
                http_request=http,
                check_result={"planLabel": "Claude Pro"},
            )
        self.assertEqual(ctx.exception.reason, "expired")


if __name__ == "__main__":
    unittest.main()
