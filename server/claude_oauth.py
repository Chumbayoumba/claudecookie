#!/usr/bin/env python3
"""Turn a live Claude session cookie into a Claude Code credentials file.

Uses the public Claude Code OAuth client (PKCE) and the already-authenticated
browser session to finish authorize, then exchanges the code at the public
token endpoint. All Claude / Anthropic hops go through the same sticky
residential proxy and Chrome TLS impersonation as the session check.

Independently implemented; do not vendor other connectors.
"""

from __future__ import annotations

import base64
import hashlib
import re
import secrets
import time
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

from claude_check import (
    CookieParseError,
    cookie_header,
    default_http_request,
    extract_fields,
    org_ids_from,
    select_proxy,
    session_auth_header,
)

# Public Claude Code OAuth client. Not a secret.
CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
AUTHORIZE_API = "https://platform.claude.com/v1/oauth/{org}/authorize"
LEGACY_AUTHORIZE_API = "https://claude.ai/v1/oauth/{org}/authorize"
ORGANIZATIONS_URL = "https://claude.ai/api/organizations"
TOKEN_URL = "https://platform.claude.com/v1/oauth/token"
API_TOKEN_URL = "https://api.anthropic.com/v1/oauth/token"
REDIRECT_URI = "https://platform.claude.com/oauth/code/callback"
LEGACY_TOKEN_URL = "https://console.anthropic.com/v1/oauth/token"
LEGACY_REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback"
# Full Claude Code scopes. A session that is valid for chat but "not fresh
# enough" for elevated grant fails this set; inference-only still mints.
SCOPE_CODE = (
    "user:profile user:inference user:sessions:claude_code "
    "user:mcp_servers user:file_upload"
)
SCOPE_INFERENCE = "user:inference"
SCOPES = SCOPE_CODE
DEFAULT_SCOPE_LIST = ["user:inference", "user:profile"]
CAI_AUTHORIZE_HEADERS = {
    "Origin": "https://claude.com",
    "Referer": "https://claude.com/cai/oauth/authorize?code=true",
    "Cache-Control": "no-cache",
    "Sec-Fetch-Site": "same-site",
}
WEB_AUTHORIZE_HEADERS = {
    "Origin": "https://claude.ai",
    "Referer": "https://claude.ai/new",
    "Cache-Control": "no-cache",
}
AUTHORIZE_HEADERS = CAI_AUTHORIZE_HEADERS
TOKEN_HEADERS = CAI_AUTHORIZE_HEADERS
STALE_MARKERS = (
    "session_stale",
    "elevated",
    "not fresh enough",
    "sign in again",
    "reauth",
    "re-login",
)
NO_PLAN_MARKERS = (
    "requires a pro or max",
    "requires a pro",
    "claude code requires",
)

SECRET_RE = re.compile(
    r"(sk-ant-[a-z0-9]+-[A-Za-z0-9_-]{8,}|sessionKey(?:V3)?=)[^\s\"'&]+",
    re.I,
)

HttpRequest = Callable[..., tuple]


class ConvertError(RuntimeError):
    def __init__(self, reason: str = "convert_failed"):
        super().__init__(reason)
        self.reason = reason


def redact(text: str) -> str:
    if not text:
        return text
    return SECRET_RE.sub("[redacted]", text)


def make_pkce() -> tuple[str, str, str]:
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    # Anthropic's authorize page rejects '-', '_', '=' in state.
    state = secrets.token_hex(16)
    return verifier, challenge, state


def build_authorize_request(
    challenge: str,
    state: str,
    org_uuid: str,
    *,
    scope: str = SCOPE_CODE,
    redirect_uri: str = REDIRECT_URI,
    authorize_url: str = AUTHORIZE_API,
) -> tuple[str, dict[str, str]]:
    org = (org_uuid or "").strip()
    if not org:
        raise ConvertError("convert_failed")
    body = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "organization_uuid": org,
        "redirect_uri": redirect_uri,
        "scope": scope,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    return authorize_url.format(org=org), body


def _code_from_url(url: str | None) -> tuple[str | None, str | None]:
    if not url:
        return None, None
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    fragment = parse_qs(parsed.fragment)
    code = (query.get("code") or fragment.get("code") or [None])[0]
    state = (query.get("state") or fragment.get("state") or [None])[0]
    if not state and parsed.fragment and "=" not in parsed.fragment:
        state = parsed.fragment
    if isinstance(code, str) and "#" in code and not state:
        code, state = code.split("#", 1)
    if isinstance(code, str) and code.strip():
        return code.strip(), (state.strip() if isinstance(state, str) and state.strip() else None)
    return None, None


def extract_authorization_code(location: str | None, body: Any) -> tuple[str | None, str | None]:
    code, state = _code_from_url(location)
    if code:
        return code, state
    if isinstance(body, dict):
        raw = (
            body.get("code")
            or body.get("authorization_code")
            or body.get("redirect")
            or body.get("redirect_uri")
            or body.get("redirectUri")
        )
        if isinstance(raw, str):
            if "://" in raw or raw.startswith("/"):
                return _code_from_url(raw)
            if raw.strip():
                piece = raw.strip()
                if "#" in piece:
                    piece, frag = piece.split("#", 1)
                    return piece, frag or None
                return piece, None
    return None, None


def subscription_type(plan_label: str | None) -> str | None:
    text = (plan_label or "").lower()
    if "max" in text:
        return "max"
    if "pro" in text:
        return "pro"
    if "team" in text or "enterprise" in text:
        return "team"
    if "free" in text:
        return "free"
    return None


def build_credentials_file(
    tokens: dict[str, Any],
    plan_label: str | None = None,
) -> dict[str, Any]:
    access = tokens.get("access_token") or tokens.get("accessToken")
    refresh = tokens.get("refresh_token") or tokens.get("refreshToken")
    if not isinstance(access, str) or not access.strip():
        raise ConvertError("convert_failed")
    if not isinstance(refresh, str) or not refresh.strip():
        raise ConvertError("no_refresh")
    expires_in = tokens.get("expires_in") or tokens.get("expiresIn")
    expires_at = tokens.get("expires_at") or tokens.get("expiresAt")
    now_ms = int(time.time() * 1000)
    if isinstance(expires_at, (int, float)) and expires_at > 10_000_000_000:
        exp_ms = int(expires_at)
    elif isinstance(expires_at, (int, float)) and expires_at > 0:
        exp_ms = int(expires_at * 1000)
    elif isinstance(expires_in, (int, float)) and expires_in > 0:
        exp_ms = now_ms + int(expires_in) * 1000
    else:
        exp_ms = now_ms + 3600 * 1000

    scopes = tokens.get("scope") or tokens.get("scopes") or DEFAULT_SCOPE_LIST
    if isinstance(scopes, str):
        scopes = [part for part in scopes.split() if part]
    if not isinstance(scopes, list) or not scopes:
        scopes = list(DEFAULT_SCOPE_LIST)

    oauth: dict[str, Any] = {
        "accessToken": access.strip(),
        "expiresAt": exp_ms,
        "scopes": [str(item) for item in scopes],
    }
    oauth["refreshToken"] = refresh.strip()
    sub = subscription_type(plan_label)
    if sub:
        oauth["subscriptionType"] = sub
    return {"claudeAiOauth": oauth}


def _call(
    http: HttpRequest,
    method: str,
    url: str,
    cookie: str,
    device: str | None,
    *,
    json_body: Any | None = None,
    extra_headers: dict[str, str] | None = None,
) -> tuple[int, Any, dict | None, str | None]:
    kwargs: dict[str, Any] = {"json_body": json_body}
    if extra_headers:
        kwargs["extra_headers"] = extra_headers
    try:
        result = http(method, url, cookie, device, **kwargs)
    except TypeError:
        result = http(method, url, cookie, device, json_body=json_body)
    if not isinstance(result, tuple):
        raise ConvertError("convert_failed")
    status = result[0]
    body = result[1] if len(result) > 1 else None
    set_cookie = result[2] if len(result) > 2 else None
    location = result[3] if len(result) > 3 else None
    return status, body, set_cookie, location


def _first_org(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, list):
            for item in value:
                if isinstance(item, str) and item.strip():
                    return item.strip()
    return None


def pick_org_uuid(body: Any) -> str | None:
    """Prefer a team org, then the first uuid — same rule as the working cookie flow."""
    items: list[Any] = []
    if isinstance(body, list):
        items = body
    elif isinstance(body, dict):
        data = body.get("data") or body.get("organizations")
        if isinstance(data, list):
            items = data
        else:
            items = [body]
    team = None
    first = None
    for item in items:
        if not isinstance(item, dict):
            continue
        uid = item.get("uuid") or item.get("id")
        if not isinstance(uid, str) or not uid.strip():
            continue
        uid = uid.strip()
        if first is None:
            first = uid
        raven = item.get("raven_type")
        if raven == "team":
            team = uid
    return team or first


def oauth_error_message(body: Any) -> str:
    if not isinstance(body, dict):
        return ""
    err = body.get("error")
    if isinstance(err, dict):
        details = err.get("details") if isinstance(err.get("details"), dict) else {}
        for key in ("message", "error_code", "type"):
            value = details.get(key) or err.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    if isinstance(err, str) and err.strip():
        return err.strip()
    value = body.get("message")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return ""


def oauth_error_code(body: Any) -> str:
    if not isinstance(body, dict):
        return ""
    err = body.get("error")
    if isinstance(err, dict):
        details = err.get("details") if isinstance(err.get("details"), dict) else {}
        for key in ("error_code", "type", "message"):
            value = details.get(key) or err.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    if isinstance(err, str) and err.strip():
        return err.strip()
    for key in ("error_code", "message"):
        value = body.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def is_stale_oauth(status: int, body: Any) -> bool:
    if status not in {401, 403}:
        return False
    hay = " ".join(
        part.lower()
        for part in (oauth_error_code(body), oauth_error_message(body), str(body or ""))
        if part
    )
    return any(marker in hay for marker in STALE_MARKERS)


def is_no_plan(status: int, body: Any, plan_label: str | None = None) -> bool:
    if status not in {401, 403}:
        return False
    hay = " ".join(
        part.lower()
        for part in (oauth_error_code(body), oauth_error_message(body), str(body or ""))
        if part
    )
    if any(marker in hay for marker in NO_PLAN_MARKERS):
        return True
    plan = (plan_label or "").lower()
    return "free" in plan and "permission_error" in hay


def resolve_org_uuid(
    fields: dict[str, str],
    check_result: dict[str, Any] | None,
    http: HttpRequest,
    header: str,
    device: str | None,
    probes: list[dict[str, Any]],
) -> str:
    extras = (check_result or {}).get("extras") if isinstance(check_result, dict) else {}
    extras_org = extras.get("organizationId") if isinstance(extras, dict) else None
    check_orgs = org_ids_from(check_result) if isinstance(check_result, dict) else []
    fallback = _first_org(extras_org, fields.get("lastActiveOrg"), check_orgs)

    status, body, _set_cookie, _location = _call(http, "GET", ORGANIZATIONS_URL, header, device)
    probes.append({"path": "organizations", "status": status})
    org = pick_org_uuid(body) if status == 200 else None
    if org:
        return org
    if fallback:
        return fallback
    if status in {401, 403}:
        raise ConvertError("expired")
    raise ConvertError("convert_failed")


def convert_session(
    raw: str,
    *,
    country: str | None = None,
    session_id: str | None = None,
    check_result: dict[str, Any] | None = None,
    http_request: HttpRequest | None = None,
) -> dict[str, Any]:
    """Return a public credentials payload or raise ConvertError.

    The returned dict is safe to send to the browser. It never logs tokens.
    """
    started = time.monotonic()
    probes: list[dict[str, Any]] = []
    if not select_proxy(country, session_id):
        raise ConvertError("unreachable")

    try:
        fields = extract_fields(raw)
    except CookieParseError as exc:
        raise ConvertError(str(exc) or "missing_session") from exc

    header = cookie_header(fields)
    auth_cookie = session_auth_header(fields)
    device = fields.get("anthropic-device-id")

    if http_request is None:
        def http(
            method: str,
            url: str,
            cookie: str,
            device_id: str | None,
            json_body: Any = None,
            extra_headers: dict[str, str] | None = None,
        ):
            return default_http_request(
                method,
                url,
                cookie,
                device_id,
                json_body=json_body,
                extra_headers=extra_headers,
                country=country,
                session_id=session_id,
                allow_redirects=False,
            )
    else:
        http = http_request

    org = resolve_org_uuid(fields, check_result, http, header, device, probes)
    last_reason = "convert_failed"
    plan_label = check_result.get("planLabel") if isinstance(check_result, dict) else None

    def attempt(
        scope: str,
        *,
        authorize_url_tmpl: str,
        redirect_uri: str,
        token_urls: tuple[str, ...],
        extra_headers: dict[str, str],
    ) -> dict[str, Any] | None:
        nonlocal last_reason
        verifier, challenge, state = make_pkce()
        authorize_url, authorize_body = build_authorize_request(
            challenge,
            state,
            org,
            scope=scope,
            redirect_uri=redirect_uri,
            authorize_url=authorize_url_tmpl,
        )
        host = urlparse(authorize_url).netloc
        status, body, _set_cookie, location = _call(
            http,
            "POST",
            authorize_url,
            auth_cookie,
            device,
            json_body=authorize_body,
            extra_headers=extra_headers,
        )
        err = oauth_error_code(body)
        message = oauth_error_message(body)
        probes.append({"path": "authorize", "status": status})
        print(
            redact(
                f"credential authorize status={status} error={err or '-'} "
                f"message={message or '-'} scope={scope.split()[0]} host={host}"
            ),
            flush=True,
        )
        if is_stale_oauth(status, body):
            last_reason = "reauth"
            return None
        if is_no_plan(status, body, plan_label):
            last_reason = "no_plan"
            return None
        if status in {401, 403}:
            last_reason = "expired"
            return None
        code, returned_state = extract_authorization_code(location, body)
        if not code:
            last_reason = "convert_failed"
            return None
        if returned_state and returned_state != state:
            last_reason = "convert_failed"
            return None
        token_body = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": CLIENT_ID,
            "code_verifier": verifier,
            "state": returned_state or state,
        }
        tokens: Any = None
        status = 0
        for token_url in token_urls:
            status, tokens, _set_cookie, _location = _call(
                http,
                "POST",
                token_url,
                "",
                device,
                json_body=token_body,
                extra_headers=TOKEN_HEADERS,
            )
            probes.append({"path": "token", "status": status})
            print(
                redact(
                    f"credential token status={status} error={oauth_error_code(tokens) or '-'} "
                    f"host={urlparse(token_url).netloc}"
                ),
                flush=True,
            )
            if status == 200 and isinstance(tokens, dict):
                break
        if status in {401, 403}:
            last_reason = "expired"
            return None
        if status != 200 or not isinstance(tokens, dict):
            last_reason = "convert_failed"
            return None
        try:
            return build_credentials_file(tokens, plan_label)
        except ConvertError as exc:
            last_reason = exc.reason or "convert_failed"
            return None

    credentials = None
    for target in (
        {
            "authorize_url": AUTHORIZE_API,
            "headers": CAI_AUTHORIZE_HEADERS,
            "redirect": REDIRECT_URI,
            "tokens": (TOKEN_URL, API_TOKEN_URL),
        },
        {
            "authorize_url": LEGACY_AUTHORIZE_API,
            "headers": WEB_AUTHORIZE_HEADERS,
            "redirect": REDIRECT_URI,
            "tokens": (TOKEN_URL, API_TOKEN_URL),
        },
        {
            "authorize_url": AUTHORIZE_API,
            "headers": CAI_AUTHORIZE_HEADERS,
            "redirect": LEGACY_REDIRECT_URI,
            "tokens": (LEGACY_TOKEN_URL,),
        },
    ):
        credentials = attempt(
            SCOPE_CODE,
            authorize_url_tmpl=target["authorize_url"],
            redirect_uri=target["redirect"],
            token_urls=target["tokens"],
            extra_headers=target["headers"],
        )
        if not credentials:
            credentials = attempt(
                SCOPE_INFERENCE,
                authorize_url_tmpl=target["authorize_url"],
                redirect_uri=target["redirect"],
                token_urls=target["tokens"],
                extra_headers=target["headers"],
            )
        if credentials:
            break
        if last_reason == "no_plan":
            break
    if not credentials:
        raise ConvertError(last_reason)

    elapsed_ms = int((time.monotonic() - started) * 1000)
    statuses = ",".join(str(item["status"]) for item in probes)
    paths = ",".join(item["path"] for item in probes)
    print(f"credential ok statuses={statuses} paths={paths} ms={elapsed_ms}", flush=True)
    return {
        "ok": True,
        "filename": ".credentials.json",
        "credentials": credentials,
    }


def format_convert_error(reason: str, started: float | None = None) -> str:
    ms = int((time.monotonic() - started) * 1000) if started else 0
    return f"credential {reason} ms={ms}"
