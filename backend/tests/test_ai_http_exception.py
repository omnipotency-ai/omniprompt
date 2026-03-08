"""Tests for _to_ai_http_exception sanitisation in backend.main."""

from __future__ import annotations

import pytest
from fastapi import status

from backend.main import _to_ai_http_exception


class TestApiKeySanitisation:
    """Inputs mentioning OPENAI_API_KEY or api_key must return 503 with a generic message."""

    def test_openai_api_key_env_var_name(self):
        exc = RuntimeError("OPENAI_API_KEY is missing from environment")
        result = _to_ai_http_exception(exc)
        assert result.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert "OPENAI_API_KEY" not in result.detail
        assert result.detail == "AI service authentication is not configured or has failed."

    def test_api_key_case_insensitive(self):
        exc = RuntimeError("Invalid Api_Key provided to the service")
        result = _to_ai_http_exception(exc)
        assert result.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert "api_key" not in result.detail.lower()


class TestTokenRedaction:
    """sk-... tokens must be replaced with [REDACTED]."""

    def test_sk_token_redacted(self):
        token = "sk-abc123XYZ789_test_key_value"
        exc = RuntimeError(f"OpenAI call failed with key {token}")
        result = _to_ai_http_exception(exc)
        assert result.status_code == status.HTTP_502_BAD_GATEWAY
        assert token not in result.detail
        assert "[REDACTED]" in result.detail


class TestPassthrough:
    """Messages with no sensitive content pass through unchanged."""

    def test_no_sensitive_content(self):
        message = "Connection timed out after 30 seconds"
        exc = RuntimeError(message)
        result = _to_ai_http_exception(exc)
        assert result.status_code == status.HTTP_502_BAD_GATEWAY
        assert result.detail == message
