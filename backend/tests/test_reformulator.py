"""Tests for backend.reformulator and the /api/reformulate endpoint."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import backend.reformulator as reformulator_mod
from backend.main import app
from backend.reformulator import reformulate


# ---------------------------------------------------------------------------
# Unit tests: reformulate()
# ---------------------------------------------------------------------------


class TestReformulateRaisesOnClientFailure:
    """reformulate() must raise RuntimeError when the OpenAI client fails."""

    def test_raises_runtime_error_when_client_raises(self):
        mock_client = MagicMock()
        mock_client.responses.parse.side_effect = Exception("Connection refused")

        with patch.object(reformulator_mod, "get_client", return_value=mock_client):
            with pytest.raises(RuntimeError, match="OpenAI reformulate request failed"):
                reformulate(
                    task_type="refactor",
                    rough_intent="Fix the mess in the components folder",
                )


class TestReformulateRaisesOnMissingStructuredOutput:
    """reformulate() must raise RuntimeError when output_parsed is falsy."""

    def test_raises_when_output_parsed_is_none(self):
        mock_response = MagicMock()
        mock_response.output_parsed = None

        mock_client = MagicMock()
        mock_client.responses.parse.return_value = mock_response

        with patch.object(reformulator_mod, "get_client", return_value=mock_client):
            with pytest.raises(RuntimeError, match="no structured output"):
                reformulate(
                    task_type="implement",
                    rough_intent="Add a close button to the modal",
                )


class TestReformulateReturnsResponse:
    """reformulate() returns a correctly shaped ReformulateResponse."""

    def test_returns_reformulate_response(self):
        mock_payload = MagicMock()
        mock_payload.reformulated_intent = "Add a close button to the modal dialog."

        mock_response = MagicMock()
        mock_response.output_parsed = mock_payload

        mock_client = MagicMock()
        mock_client.responses.parse.return_value = mock_response

        with patch.object(reformulator_mod, "get_client", return_value=mock_client):
            result = reformulate(
                task_type="implement",
                rough_intent="add close button modal",
            )

        assert result.original_intent == "add close button modal"
        assert result.reformulated_intent == "Add a close button to the modal dialog."


# ---------------------------------------------------------------------------
# Endpoint tests: POST /api/reformulate
# ---------------------------------------------------------------------------


class TestReformulateEndpoint:
    """The /api/reformulate endpoint must delegate to reformulate() correctly."""

    @pytest.fixture()
    def client(self):
        return TestClient(app)

    def test_returns_200_with_valid_payload(self, client):
        mock_result = MagicMock()
        mock_result.original_intent = "fix the auth flow it breaks on logout"
        mock_result.reformulated_intent = (
            "The authentication flow breaks during logout. Fix the logout handler so it "
            "correctly clears session state and redirects to the login page."
        )

        with patch("backend.main.reformulate", return_value=mock_result):
            response = client.post(
                "/api/reformulate",
                json={"task_type": "refactor", "rough_intent": "fix the auth flow it breaks on logout"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["original_intent"] == mock_result.original_intent
        assert data["reformulated_intent"] == mock_result.reformulated_intent

    def test_returns_422_for_empty_rough_intent(self, client):
        response = client.post(
            "/api/reformulate",
            json={"task_type": "refactor", "rough_intent": ""},
        )
        assert response.status_code == 422

    def test_returns_422_for_invalid_task_type(self, client):
        response = client.post(
            "/api/reformulate",
            json={"task_type": "invalid_type", "rough_intent": "Do something"},
        )
        assert response.status_code == 422

    def test_propagates_runtime_error_as_502(self, client):
        with patch("backend.main.reformulate", side_effect=RuntimeError("Model timed out")):
            response = client.post(
                "/api/reformulate",
                json={"task_type": "audit", "rough_intent": "Check the codebase"},
            )
        assert response.status_code == 502
        assert "Model timed out" in response.json()["detail"]
