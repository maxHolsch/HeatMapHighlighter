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

from pricing import record_usage

_client: Optional[Anthropic] = None


# Models that have deprecated the `temperature` parameter. Kept as a set
# (not a regex) so it's obvious which families are affected — current Opus
# 4.x series rejects temperature with a 400.
_NO_TEMPERATURE_MODELS = {
    "claude-opus-4-7",
    "claude-opus-4-6",
    "claude-opus-4-5",
}


def _supports_temperature(model: str) -> bool:
    return model not in _NO_TEMPERATURE_MODELS


def _usage_dict(resp) -> Dict[str, int]:
    u = getattr(resp, "usage", None)
    if u is None:
        return {}
    return {
        "input_tokens": getattr(u, "input_tokens", 0) or 0,
        "output_tokens": getattr(u, "output_tokens", 0) or 0,
        "cache_read_input_tokens": getattr(u, "cache_read_input_tokens", 0) or 0,
        "cache_creation_input_tokens": getattr(u, "cache_creation_input_tokens", 0) or 0,
    }


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
    usage_label: Optional[str] = None,
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
    if _supports_temperature(model):
        kwargs["temperature"] = temperature
    if system:
        kwargs["system"] = system

    resp = client.messages.create(**kwargs)
    record_usage(label=usage_label or tool_name, model=model, usage=_usage_dict(resp))

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
    usage_label: str = "text",
) -> str:
    """Single-shot plain-text response (for short free-form explanations)."""
    client = get_client()
    kwargs: Dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if _supports_temperature(model):
        kwargs["temperature"] = temperature
    if system:
        kwargs["system"] = system
    resp = client.messages.create(**kwargs)
    record_usage(label=usage_label, model=model, usage=_usage_dict(resp))
    parts: List[str] = []
    for block in resp.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "".join(parts).strip()
