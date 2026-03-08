"""Shared OpenAI client instance for HTTP connection reuse."""

from __future__ import annotations

import os
import threading

from openai import OpenAI

_lock = threading.Lock()
_client: OpenAI | None = None


def get_client() -> OpenAI:
    """Return a module-level OpenAI client, creating it on first call.

    Uses double-checked locking to avoid races in threaded contexts.
    Raises RuntimeError if OPENAI_API_KEY is not set.
    """
    global _client
    if _client is not None:
        return _client
    with _lock:
        if _client is None:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise RuntimeError("OPENAI_API_KEY is not configured.")
            _client = OpenAI(api_key=api_key)
    return _client
