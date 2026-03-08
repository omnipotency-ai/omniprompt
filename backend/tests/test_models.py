"""Tests for backend.models domain models."""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from backend.models import (
    ClarifyingAnswer,
    ClarifyingOption,
    ClarifyingQuestion,
    ClarifyRound,
    CompileResponse,
    CompiledVersion,
    Prompt,
    PromptCreateRequest,
    RouteResponse,
    Session,
    SessionCreateRequest,
    SessionUpdateRequest,
)

NOW = datetime(2026, 3, 8, 12, 0, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# TaskType
# ---------------------------------------------------------------------------


class TestTaskType:
    @pytest.mark.parametrize("tt", ["refactor", "frontend", "audit", "implement"])
    def test_valid_task_types(self, tt):
        s = SessionCreateRequest(task_type=tt)
        assert s.task_type == tt

    def test_invalid_task_type(self):
        with pytest.raises(ValidationError):
            SessionCreateRequest(task_type="frontend_iteration")


# ---------------------------------------------------------------------------
# ModelChoice
# ---------------------------------------------------------------------------


class TestModelChoice:
    VALID_MODELS = [
        "gpt-5.4",
        "gpt-5-mini",
        "gpt-4.1",
        "claude-opus-4-6",
        "claude-sonnet-4-6",
        "claude-haiku-4-5",
        "gemini-3.0-flash",
        "gemini-3.0-pro",
        "kimi-k2.5",
        "minimax-m2.5",
    ]

    @pytest.mark.parametrize("model", VALID_MODELS)
    def test_valid_models(self, model):
        req = SessionUpdateRequest(selected_model=model)
        assert req.selected_model == model

    def test_unknown_model_rejected(self):
        with pytest.raises(ValidationError):
            SessionUpdateRequest(selected_model="llama-4")


# ---------------------------------------------------------------------------
# SessionStatus
# ---------------------------------------------------------------------------


class TestSessionStatus:
    @pytest.mark.parametrize("status", ["draft", "open", "closed"])
    def test_valid_statuses(self, status):
        s = Session(
            id="s1", created_at=NOW, updated_at=NOW, status=status
        )
        assert s.status == status


# ---------------------------------------------------------------------------
# ClarifyingQuestion
# ---------------------------------------------------------------------------


class TestClarifyingQuestion:
    def test_free_text_no_options(self):
        q = ClarifyingQuestion(
            id="q1", question="What do you need?", input_type="free_text"
        )
        assert q.input_type == "free_text"
        assert q.options == []

    def test_choice_with_fewer_than_2_options_fails(self):
        with pytest.raises(ValidationError, match="at least two options"):
            ClarifyingQuestion(
                id="q1",
                question="Pick one",
                input_type="single_choice",
                options=[ClarifyingOption(label="Only one", value="one")],
            )

    def test_free_text_with_options_fails(self):
        with pytest.raises(ValidationError, match="cannot include options"):
            ClarifyingQuestion(
                id="q1",
                question="Describe it",
                input_type="free_text",
                options=[
                    ClarifyingOption(label="A", value="a"),
                    ClarifyingOption(label="B", value="b"),
                ],
            )

    def test_single_choice_valid(self):
        q = ClarifyingQuestion(
            id="q1",
            question="Pick one",
            input_type="single_choice",
            options=[
                ClarifyingOption(label="A", value="a"),
                ClarifyingOption(label="B", value="b"),
            ],
        )
        assert len(q.options) == 2


# ---------------------------------------------------------------------------
# ClarifyRound
# ---------------------------------------------------------------------------


class TestClarifyRound:
    def test_valid_creation(self):
        r = ClarifyRound(id="r1", round_number=1, created_at=NOW)
        assert r.round_number == 1
        assert r.questions == []
        assert r.answers == []

    def test_round_number_must_be_ge_1(self):
        with pytest.raises(ValidationError):
            ClarifyRound(id="r1", round_number=0, created_at=NOW)


# ---------------------------------------------------------------------------
# CompiledVersion
# ---------------------------------------------------------------------------


class TestCompiledVersion:
    def test_valid_creation(self):
        cv = CompiledVersion(
            id="cv1",
            version_label="1",
            compiled_prompt="Do the thing",
            target_model="gpt-5.4",
            project_context_used=True,
            created_at=NOW,
        )
        assert cv.version_label == "1"
        assert cv.target_model == "gpt-5.4"


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------


class TestSession:
    def test_minimal_session(self):
        s = Session(id="s1", created_at=NOW, updated_at=NOW)
        assert s.status == "draft"
        assert s.clarify_rounds == []
        assert s.compiled_versions == []
        assert s.reformulated_intent is None
        assert s.selected_model is None

    def test_clarify_rounds_appended(self):
        r = ClarifyRound(id="r1", round_number=1, created_at=NOW)
        s = Session(
            id="s1", created_at=NOW, updated_at=NOW, clarify_rounds=[r]
        )
        assert len(s.clarify_rounds) == 1
        assert s.clarify_rounds[0].id == "r1"

    def test_compiled_versions_list(self):
        cv = CompiledVersion(
            id="cv1",
            version_label="1",
            compiled_prompt="prompt",
            target_model="claude-sonnet-4-6",
            project_context_used=False,
            created_at=NOW,
        )
        s = Session(
            id="s1",
            created_at=NOW,
            updated_at=NOW,
            compiled_versions=[cv],
        )
        assert len(s.compiled_versions) == 1


# ---------------------------------------------------------------------------
# SessionCreateRequest
# ---------------------------------------------------------------------------


class TestSessionCreateRequest:
    def test_valid_create(self):
        req = SessionCreateRequest(
            project_id="p1", task_type="refactor", rough_intent="Fix stuff"
        )
        assert req.status == "draft"

    def test_invalid_empty_project_id(self):
        with pytest.raises(ValidationError):
            SessionCreateRequest(project_id="")


# ---------------------------------------------------------------------------
# SessionUpdateRequest
# ---------------------------------------------------------------------------


class TestSessionUpdateRequest:
    def test_at_least_one_field_required(self):
        with pytest.raises(ValidationError, match="at least one change"):
            SessionUpdateRequest()

    def test_update_status_only(self):
        req = SessionUpdateRequest(status="open")
        assert req.status == "open"

    def test_update_multiple_fields(self):
        req = SessionUpdateRequest(
            task_type="audit", rough_intent="Check security"
        )
        assert req.task_type == "audit"
        assert req.rough_intent == "Check security"

    def test_update_selected_model(self):
        req = SessionUpdateRequest(selected_model="gpt-5.4")
        assert req.selected_model == "gpt-5.4"


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------


class TestPrompt:
    def _make(self, **overrides):
        defaults = dict(
            id="p1",
            project_id="proj1",
            task_type="refactor",
            rough_intent="Fix it",
            compiled_prompt="Do it properly",
            target_model="gpt-5.4",
            created_at=NOW,
        )
        defaults.update(overrides)
        return Prompt(**defaults)

    def test_rating_1_valid(self):
        p = self._make(effectiveness_rating=1)
        assert p.effectiveness_rating == 1

    def test_rating_7_valid(self):
        p = self._make(effectiveness_rating=7)
        assert p.effectiveness_rating == 7

    def test_rating_0_invalid(self):
        with pytest.raises(ValidationError):
            self._make(effectiveness_rating=0)

    def test_rating_8_invalid(self):
        with pytest.raises(ValidationError):
            self._make(effectiveness_rating=8)

    def test_expected_result_assessment(self):
        p = self._make(expected_result_assessment="It works because reasons")
        assert p.expected_result_assessment == "It works because reasons"

    def test_compiled_version_id_default_null(self):
        p = self._make()
        assert p.compiled_version_id is None


# ---------------------------------------------------------------------------
# PromptCreateRequest
# ---------------------------------------------------------------------------


class TestPromptCreateRequest:
    def test_valid_creation(self):
        req = PromptCreateRequest(
            project_id="proj1",
            task_type="implement",
            rough_intent="Add feature",
            compiled_prompt="Detailed prompt here",
            target_model="claude-sonnet-4-6",
        )
        assert req.task_type == "implement"


# ---------------------------------------------------------------------------
# RouteResponse
# ---------------------------------------------------------------------------


class TestRouteResponse:
    def test_valid_creation(self):
        r = RouteResponse(
            task_type="frontend",
            recommended_model="claude-sonnet-4-6",
            estimated_complexity="high",
            reasoning="Complex UI work requiring structured approach",
        )
        assert r.advisory_only is True
        assert r.budget_alternative is None


# ---------------------------------------------------------------------------
# CompileResponse
# ---------------------------------------------------------------------------


class TestCompileResponse:
    def test_valid_creation(self):
        c = CompileResponse(
            task_type="audit",
            target_model="gpt-5.4",
            compiled_prompt="Audit the codebase for security issues",
            project_context_used=True,
        )
        assert c.project_context_used is True
