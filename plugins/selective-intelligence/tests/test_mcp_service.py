#!/usr/bin/env python3
"""Dependency-free tests for the SI MCP service boundary."""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from mcp_server import service


class ServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        os.environ["SI_SESSION_DIR"] = str(Path(self.temp.name) / "sessions")
        os.environ["SI_WORKSPACE_ROOT"] = str(Path(self.temp.name) / "workspaces")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _start(self) -> dict:
        result = service.start_session("Build a truthful product planning assistant.")
        self.assertTrue(result["ok"])
        return result

    def test_session_starts_locked_with_proposed_checkpoint(self) -> None:
        result = self._start()
        session = result["session"]
        self.assertTrue(session["executionLocked"])
        self.assertEqual(session["currentCheckpoint"]["status"], "proposed")

    def test_approval_requires_matching_hash(self) -> None:
        started = self._start()["session"]
        rejected = service.safe_call(
            service.approve_checkpoint,
            started["sessionId"],
            started["currentCheckpoint"]["checkpoint_id"],
            "0" * 64,
        )
        self.assertFalse(rejected["ok"])
        approved = service.approve_checkpoint(
            started["sessionId"],
            started["currentCheckpoint"]["checkpoint_id"],
            started["currentCheckpoint"]["intent_hash"],
        )
        self.assertTrue(approved["ok"])
        self.assertFalse(approved["session"]["executionLocked"])

    def test_choices_do_not_authorize_execution(self) -> None:
        started = self._start()["session"]
        choices = service.generate_choices(started["sessionId"])
        selected = service.submit_choice(
            started["sessionId"],
            ["finish"],
            choices["choiceSetHash"],
        )
        self.assertEqual(selected["status"], "recorded_not_authorized")
        current = service.get_session(started["sessionId"])
        self.assertTrue(current["session"]["executionLocked"])

    def test_correction_replaces_authority_with_new_checkpoint(self) -> None:
        started = self._start()["session"]
        corrected = service.correct_intent(
            started["sessionId"],
            "Do not build it; audit the design only.",
            started["currentCheckpoint"]["checkpoint_id"],
        )
        self.assertTrue(corrected["session"]["executionLocked"])
        self.assertEqual(corrected["status"], "interrupted_requires_approval")

    def test_missing_session_is_structured(self) -> None:
        result = service.safe_call(service.get_session, "si-missing")
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["code"], "SESSION_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
