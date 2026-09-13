#!/usr/bin/env python3
"""P-256 ECDH + HKDF-SHA256 + AES-GCM box.

The browser seals convert/check payloads with the ingest public key; this module
opens them. The private key never leaves the server. Algorithm parameters must
stay in lockstep with lib/box.ts.
"""

from __future__ import annotations

import base64
import json
import os
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

CURVE = ec.SECP256R1()
BOX_INFO = b"claudecookie-box-v1"
DEFAULT_KEY_PATH = os.environ.get("CC_BOX_KEY", "/etc/claudecookie/box.key")


class BoxError(ValueError):
    """Malformed or undecryptable box. Never include ciphertext in the message."""


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(text: str) -> bytes:
    if not isinstance(text, str) or not text:
        raise BoxError("b64")
    pad = "=" * (-len(text) % 4)
    try:
        return base64.urlsafe_b64decode(text + pad)
    except (ValueError, TypeError) as exc:
        raise BoxError("b64") from exc


def _int_to_coord(n: int) -> bytes:
    return n.to_bytes(32, "big")


def public_jwk(private: ec.EllipticCurvePrivateKey) -> dict[str, str]:
    nums = private.public_key().public_numbers()
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": _b64url(_int_to_coord(nums.x)),
        "y": _b64url(_int_to_coord(nums.y)),
    }


def _public_from_jwk(jwk: dict) -> ec.EllipticCurvePublicKey:
    if not isinstance(jwk, dict) or jwk.get("kty") != "EC" or jwk.get("crv") != "P-256":
        raise BoxError("epk")
    try:
        x = int.from_bytes(_b64url_decode(jwk["x"]), "big")
        y = int.from_bytes(_b64url_decode(jwk["y"]), "big")
        return ec.EllipticCurvePublicNumbers(x, y, CURVE).public_key()
    except (KeyError, ValueError, TypeError) as exc:
        raise BoxError("epk") from exc


def _derive_aes(private: ec.EllipticCurvePrivateKey, peer: ec.EllipticCurvePublicKey) -> bytes:
    shared = private.exchange(ec.ECDH(), peer)
    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"",
        info=BOX_INFO,
    ).derive(shared)


def generate_private() -> ec.EllipticCurvePrivateKey:
    return ec.generate_private_key(CURVE)


def serialize_private(private: ec.EllipticCurvePrivateKey) -> bytes:
    return private.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )


def load_private(pem: bytes) -> ec.EllipticCurvePrivateKey:
    key = serialization.load_pem_private_key(pem, password=None)
    if not isinstance(key, ec.EllipticCurvePrivateKey):
        raise BoxError("key")
    return key


def write_new_key(path: str | Path) -> ec.EllipticCurvePrivateKey:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    private = generate_private()
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(serialize_private(private))
    try:
        os.chmod(tmp, 0o640)
    except OSError:
        pass
    tmp.replace(path)
    try:
        os.chmod(path, 0o640)
    except OSError:
        pass
    return private


def load_or_create_private(path: str | Path | None = None) -> ec.EllipticCurvePrivateKey:
    path = Path(path or os.environ.get("CC_BOX_KEY", DEFAULT_KEY_PATH))
    if path.is_file():
        return load_private(path.read_bytes())
    try:
        return write_new_key(path)
    except OSError:
        fallback = Path(os.environ.get("CC_STATS_DB", "/var/lib/claudecookie/stats.db")).with_name("box.key")
        if fallback.is_file():
            return load_private(fallback.read_bytes())
        return write_new_key(fallback)


def looks_like_box(data: Any) -> bool:
    return (
        isinstance(data, dict)
        and data.get("v") == 1
        and isinstance(data.get("epk"), dict)
        and isinstance(data.get("iv"), str)
        and isinstance(data.get("ct"), str)
    )


def seal(private: ec.EllipticCurvePrivateKey, plaintext: bytes) -> dict[str, Any]:
    """Used by tests. Production sealing happens in the browser."""
    eph = generate_private()
    aes = _derive_aes(eph, private.public_key())
    iv = os.urandom(12)
    ct = AESGCM(aes).encrypt(iv, plaintext, None)
    return {
        "v": 1,
        "epk": public_jwk(eph),
        "iv": _b64url(iv),
        "ct": _b64url(ct),
    }


def open_box(private: ec.EllipticCurvePrivateKey, box: dict) -> bytes:
    if not looks_like_box(box):
        raise BoxError("shape")
    peer = _public_from_jwk(box["epk"])
    iv = _b64url_decode(box["iv"])
    ct = _b64url_decode(box["ct"])
    if len(iv) != 12 or not ct:
        raise BoxError("shape")
    aes = _derive_aes(private, peer)
    try:
        return AESGCM(aes).decrypt(iv, ct, None)
    except Exception as exc:
        raise BoxError("open") from exc


def open_json(private: ec.EllipticCurvePrivateKey, box: dict) -> dict:
    raw = open_box(private, box)
    if len(raw) > 512 * 1024:
        raise BoxError("size")
    try:
        data = json.loads(raw)
    except (ValueError, TypeError) as exc:
        raise BoxError("json") from exc
    if not isinstance(data, dict):
        raise BoxError("json")
    return data
