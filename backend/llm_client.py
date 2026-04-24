"""
Thin Anthropic client wrapper with structured-output tool-use helpers.

All LLM calls in this project go through `run_structured(...)`: we declare
a single tool whose `input_schema` is the JSON shape we want, force
`tool_choice` to that tool, and pick the first tool_use block out of the
response. This gives us reliable structured output and keeps the call-site
code identical in spirit to the old `client.chat.completions.parse`.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from anthropic import Anthropic

_client: Optional[Anthropic] = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. Export it before starting the backend."
            )
        _client = Anthropic()
    return _client


def run_structured(
    *,
    model: str,
    prompt: str,
    tool_name: str,
    tool_description: str,
    input_schema: Dict[str, Any],
    system: Optional[str] = None,
    max_tokens: int = 8192,
    temperature: float = 0.0,
    extra_messages: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Send a single-shot prompt and force the model to return via a tool call
    matching `input_schema`. Returns the tool call's `input` dict.
    """
    client = get_client()

    messages: List[Dict[str, Any]] = []
    if extra_messages:
        messages.extend(extra_messages)
    messages.append({"role": "user", "content": prompt})

    kwargs: Dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": messages,
        "tools": [
            {
                "name": tool_name,
                "description": tool_description,
                "input_schema": input_schema,
            }
        ],
        "tool_choice": {"type": "tool", "name": tool_name},
    }
    if system:
        kwargs["system"] = system

    resp = client.messages.create(**kwargs)

    for block in resp.content:
        if getattr(block, "type", None) == "tool_use" and block.name == tool_name:
            return dict(block.input)

    raise RuntimeError(
        f"Anthropic response did not contain a tool_use block for tool "
        f"{tool_name!r}. stop_reason={resp.stop_reason}"
    )


def run_text(
    *,
    model: str,
    prompt: str,
    system: Optional[str] = None,
    max_tokens: int = 1024,
    temperature: float = 0.2,
) -> str:
    """Single-shot plain-text response (for short free-form explanations)."""
    client = get_client()
    kwargs: Dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        kwargs["system"] = system
    resp = client.messages.create(**kwargs)
    parts: List[str] = []
    for block in resp.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "".join(parts).strip()
