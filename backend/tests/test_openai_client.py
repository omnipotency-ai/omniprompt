"""Tests for backend.openai_client – singleton get_client() behaviour."""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

import backend.openai_client as client_mod


@pytest.fixture(autouse=True)
def _reset_singleton():
    """Reset the module-level singleton before each test."""
    original = client_mod._client
    client_mod._client = None
    yield
    client_mod._client = original


class TestGetClientMissingKey:
    """get_client() must raise RuntimeError when OPENAI_API_KEY is unset."""

    def test_raises_when_key_missing(self):
        with patch.dict(os.environ, {}, clear=True):
            # Ensure the key is definitely absent
            os.environ.pop("OPENAI_API_KEY", None)
            with pytest.raises(RuntimeError, match="OPENAI_API_KEY is not configured"):
                client_mod.get_client()


class TestGetClientSingleton:
    """Repeated calls must return the exact same instance."""

    def test_returns_same_instance(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-key-for-unit-tests"}):
            first = client_mod.get_client()
            second = client_mod.get_client()
            assert first is second
