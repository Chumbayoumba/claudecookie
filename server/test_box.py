#!/usr/bin/env python3
"""Box round-trip and rejection of junk. No network."""

import json
import tempfile
import unittest
from pathlib import Path

from box import (
    BoxError,
    load_or_create_private,
    looks_like_box,
    open_json,
    public_jwk,
    seal,
    write_new_key,
)


class BoxTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.key_path = Path(self.tmp.name) / "box.key"
        self.private = write_new_key(self.key_path)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_round_trip(self) -> None:
        payload = {"cookie": "sessionKey=abc", "l": "en"}
        box = seal(self.private, json.dumps(payload).encode())
        self.assertTrue(looks_like_box(box))
        self.assertEqual(open_json(self.private, box), payload)

    def test_public_jwk_shape(self) -> None:
        jwk = public_jwk(self.private)
        self.assertEqual(jwk["kty"], "EC")
        self.assertEqual(jwk["crv"], "P-256")
        self.assertTrue(jwk["x"])
        self.assertTrue(jwk["y"])
        self.assertNotIn("d", jwk)

    def test_load_existing(self) -> None:
        again = load_or_create_private(self.key_path)
        box = seal(self.private, b'{"t":"pageview"}')
        self.assertEqual(open_json(again, box)["t"], "pageview")

    def test_wrong_key(self) -> None:
        other = write_new_key(Path(self.tmp.name) / "other.key")
        box = seal(self.private, b'{"a":1}')
        with self.assertRaises(BoxError):
            open_json(other, box)

    def test_plaintext_is_not_a_box(self) -> None:
        self.assertFalse(looks_like_box({"cookie": "sessionKey=abc", "l": "en"}))
        self.assertFalse(looks_like_box({"t": "convert", "out": "x"}))


if __name__ == "__main__":
    unittest.main()
