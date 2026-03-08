"""Tests for backend.migrate transformation functions."""

import json
import os
from pathlib import Path

import pytest

from backend.migrate import (
    atomic_write,
    migrate_library_prompt,
    migrate_session,
)


# ---------------------------------------------------------------------------
# Session migration
# ---------------------------------------------------------------------------


class TestMigrateSession:
    def _old_session(self, **overrides):
        base = {
            "id": "sess-1",
            "project_id": "proj-1",
            "task_type": "refactor",
            "title": "Test session",
            "rough_intent": "Fix things",
            "clarifying_questions": [
                {
                    "id": "q1",
                    "question": "What scope?",
                    "input_type": "single_choice",
                    "options": [
                        {"label": "A", "value": "a"},
                        {"label": "B", "value": "b"},
                    ],
                    "placeholder": None,
                }
            ],
            "clarifying_answers": [
                {"question_id": "q1", "question": "What scope?", "answer": "a"}
            ],
            "compile_result": {
                "task_type": "refactor",
                "target_model": "gpt-5.4",
                "compiled_prompt": "Do the refactor",
                "project_context_used": True,
            },
            "notes": [{"text": "some note"}],
            "status": "open",
            "created_at": "2026-03-07T12:00:00Z",
            "updated_at": "2026-03-07T13:00:00Z",
        }
        base.update(overrides)
        return base

    def test_clarify_rounds_created(self):
        data = self._old_session()
        result, changes = migrate_session(data)

        assert "clarify_rounds" in result
        assert len(result["clarify_rounds"]) == 1
        rnd = result["clarify_rounds"][0]
        assert rnd["round_number"] == 1
        assert len(rnd["questions"]) == 1
        assert len(rnd["answers"]) == 1
        assert "id" in rnd
        assert rnd["created_at"] == "2026-03-07T13:00:00Z"

    def test_old_keys_removed(self):
        data = self._old_session()
        result, _ = migrate_session(data)

        assert "clarifying_questions" not in result
        assert "clarifying_answers" not in result
        assert "compile_result" not in result
        assert "notes" not in result

    def test_compiled_versions_created(self):
        data = self._old_session()
        result, changes = migrate_session(data)

        assert "compiled_versions" in result
        assert len(result["compiled_versions"]) == 1
        cv = result["compiled_versions"][0]
        assert cv["version_label"] == "1"
        assert cv["compiled_prompt"] == "Do the refactor"
        assert cv["target_model"] == "gpt-5.4"
        assert cv["project_context_used"] is True

    def test_null_compile_result(self):
        data = self._old_session(compile_result=None)
        result, changes = migrate_session(data)

        assert result["compiled_versions"] == []

    def test_empty_questions_and_answers(self):
        data = self._old_session(clarifying_questions=[], clarifying_answers=[])
        result, changes = migrate_session(data)

        assert result["clarify_rounds"] == []

    def test_new_fields_added(self):
        data = self._old_session()
        result, changes = migrate_session(data)

        assert result["reformulated_intent"] is None
        assert result["selected_model"] is None

    def test_task_type_frontend_iteration_renamed(self):
        data = self._old_session(task_type="frontend_iteration")
        result, changes = migrate_session(data)

        assert result["task_type"] == "frontend"

    def test_status_preserved(self):
        data = self._old_session(status="closed")
        result, _ = migrate_session(data)
        assert result["status"] == "closed"

    def test_idempotent(self):
        """Running migration twice produces no further changes."""
        data = self._old_session()
        result, changes1 = migrate_session(data)
        assert len(changes1) > 0

        result2, changes2 = migrate_session(result)
        assert len(changes2) == 0


# ---------------------------------------------------------------------------
# Library prompt migration
# ---------------------------------------------------------------------------


class TestMigrateLibraryPrompt:
    def _old_prompt(self, **overrides):
        base = {
            "id": "prompt-1",
            "project_id": "proj-1",
            "task_type": "refactor",
            "session_id": None,
            "title": "Test prompt",
            "rough_intent": "Do something",
            "compiled_prompt": "Detailed prompt",
            "target_model": "gpt-5.4",
            "why_it_works": "Because it is good",
            "effectiveness_rating": 3,
            "created_at": "2026-03-07T12:00:00Z",
        }
        base.update(overrides)
        return base

    def test_why_it_works_renamed(self):
        data = self._old_prompt()
        result, changes = migrate_library_prompt(data)

        assert "why_it_works" not in result
        assert result["expected_result_assessment"] == "Because it is good"

    def test_compiled_version_id_added(self):
        data = self._old_prompt()
        result, changes = migrate_library_prompt(data)

        assert result["compiled_version_id"] is None

    def test_rating_preserved(self):
        data = self._old_prompt(effectiveness_rating=5)
        result, _ = migrate_library_prompt(data)
        assert result["effectiveness_rating"] == 5

    def test_idempotent(self):
        data = self._old_prompt()
        result, changes1 = migrate_library_prompt(data)
        assert len(changes1) > 0

        result2, changes2 = migrate_library_prompt(result)
        assert len(changes2) == 0


# ---------------------------------------------------------------------------
# Atomic write
# ---------------------------------------------------------------------------


class TestAtomicWrite:
    def test_atomic_write_creates_file(self, tmp_path):
        target = tmp_path / "test.json"
        data = {"key": "value"}
        atomic_write(target, data)

        assert target.exists()
        loaded = json.loads(target.read_text())
        assert loaded == data

    def test_atomic_write_no_leftover_tmp(self, tmp_path):
        target = tmp_path / "test.json"
        atomic_write(target, {"a": 1})

        tmp_file = tmp_path / "test.json.tmp"
        assert not tmp_file.exists()


# ---------------------------------------------------------------------------
# End-to-end with temp files
# ---------------------------------------------------------------------------


class TestEndToEndMigration:
    def test_session_file_roundtrip(self, tmp_path):
        """Write an old-format session, migrate it, validate it loads."""
        old_data = {
            "id": "e2e-sess",
            "project_id": "proj-1",
            "task_type": "frontend_iteration",
            "title": None,
            "rough_intent": "Improve the UI",
            "clarifying_questions": [],
            "clarifying_answers": [],
            "compile_result": None,
            "notes": [],
            "status": "open",
            "route_result": None,
            "created_at": "2026-03-07T12:00:00Z",
            "updated_at": "2026-03-07T12:00:00Z",
        }

        file_path = tmp_path / "e2e-sess.json"
        file_path.write_text(json.dumps(old_data))

        data = json.loads(file_path.read_text())
        data, changes = migrate_session(data)
        atomic_write(file_path, data)

        # Validate against new model
        from backend.models import Session

        loaded = json.loads(file_path.read_text())
        s = Session.model_validate(loaded)
        assert s.task_type == "frontend"
        assert s.clarify_rounds == []
        assert s.compiled_versions == []
        assert s.reformulated_intent is None

    def test_library_file_roundtrip(self, tmp_path):
        """Write an old-format library prompt, migrate it, validate it loads."""
        old_data = {
            "id": "e2e-prompt",
            "project_id": "proj-1",
            "task_type": "refactor",
            "session_id": None,
            "title": "Test",
            "rough_intent": "Intent",
            "compiled_prompt": "Compiled",
            "target_model": "gpt-5.4",
            "why_it_works": "It works well",
            "effectiveness_rating": 4,
            "created_at": "2026-03-07T12:00:00Z",
        }

        file_path = tmp_path / "e2e-prompt.json"
        file_path.write_text(json.dumps(old_data))

        data = json.loads(file_path.read_text())
        data, changes = migrate_library_prompt(data)
        atomic_write(file_path, data)

        from backend.models import Prompt

        loaded = json.loads(file_path.read_text())
        p = Prompt.model_validate(loaded)
        assert p.expected_result_assessment == "It works well"
        assert p.compiled_version_id is None
