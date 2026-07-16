"""Loop 210 — atomic, race-safe, restrictive token persistence."""
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path

_REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO / "outlook-skills"))

import token_helper  # noqa: E402


class TokenPersistTest(unittest.TestCase):

    def setUp(self):
        self._dir = tempfile.TemporaryDirectory()
        base = Path(self._dir.name)
        self._orig_tf, self._orig_lf = token_helper.TOKEN_FILE, token_helper.LOCK_FILE
        token_helper.TOKEN_FILE = base / "tokens.json"
        token_helper.LOCK_FILE = base / "tokens.json.lock"

    def tearDown(self):
        token_helper.TOKEN_FILE, token_helper.LOCK_FILE = self._orig_tf, self._orig_lf
        self._dir.cleanup()

    def test_save_round_trips(self):
        token_helper._save_tokens({"access_token": "x", "scopes": ["a"]})
        self.assertEqual(json.loads(token_helper.TOKEN_FILE.read_text())["access_token"], "x")

    def test_no_leftover_tmp(self):
        token_helper._save_tokens({"a": 1})
        leftovers = list(token_helper.TOKEN_FILE.parent.glob("tokens.json.*.tmp"))
        self.assertEqual(leftovers, [])

    def test_lock_reacquirable_and_released(self):
        with token_helper._refresh_lock():
            self.assertTrue(token_helper.LOCK_FILE.exists())
        self.assertFalse(token_helper.LOCK_FILE.exists())
        with token_helper._refresh_lock():  # must be re-acquirable
            pass

    def test_concurrent_saves_never_corrupt(self):
        # Real usage serializes refresh+save under _refresh_lock; exercise that
        # path so we verify the lock prevents both corruption and replace races.
        def worker(i):
            for _ in range(5):
                with token_helper._refresh_lock():
                    token_helper._save_tokens({"access_token": f"t{i}", "scopes": ["a", "b"]})
        threads = [threading.Thread(target=worker, args=(i,)) for i in range(6)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        # The file must always be complete, valid JSON — never a torn write.
        data = json.loads(token_helper.TOKEN_FILE.read_text())
        self.assertIn("access_token", data)
        self.assertEqual(data["scopes"], ["a", "b"])


if __name__ == "__main__":
    unittest.main()
