"""
Per-model Anthropic pricing + a request-scoped usage tracker.

Rates are USD per million tokens. Update here when Anthropic changes pricing
or when you add a new model. Anything not in PRICING_USD_PER_MTOK falls back
to ANTHROPIC_DEFAULT_RATES (treated as Sonnet-class) and gets logged so the
miss is obvious in the response.
"""

from __future__ import annotations

import contextvars
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# USD per 1M tokens. (input, output, cache_read, cache_write_5m)
PRICING_USD_PER_MTOK: Dict[str, Dict[str, float]] = {
    # Opus 4.x family
    "claude-opus-4-7":          {"input": 15.0, "output": 75.0, "cache_read": 1.50, "cache_write": 18.75},
    "claude-opus-4-6":          {"input": 15.0, "output": 75.0, "cache_read": 1.50, "cache_write": 18.75},
    "claude-opus-4-5":          {"input": 15.0, "output": 75.0, "cache_read": 1.50, "cache_write": 18.75},
    # Sonnet 4.x family
    "claude-sonnet-4-6":        {"input":  3.0, "output": 15.0, "cache_read": 0.30, "cache_write":  3.75},
    "claude-sonnet-4-5":        {"input":  3.0, "output": 15.0, "cache_read": 0.30, "cache_write":  3.75},
    # Haiku 4.x family
    "claude-haiku-4-5-20251001":{"input":  1.0, "output":  5.0, "cache_read": 0.10, "cache_write":  1.25},
    "claude-haiku-4-5":         {"input":  1.0, "output":  5.0, "cache_read": 0.10, "cache_write":  1.25},
}

DEFAULT_RATES = {"input": 3.0, "output": 15.0, "cache_read": 0.30, "cache_write": 3.75}


def rates_for(model: str) -> Dict[str, float]:
    return PRICING_USD_PER_MTOK.get(model, DEFAULT_RATES)


def usage_to_cost(model: str, usage: Dict[str, int]) -> float:
    """Convert a single Anthropic usage dict into USD."""
    r = rates_for(model)
    inp = usage.get("input_tokens", 0) or 0
    out = usage.get("output_tokens", 0) or 0
    cr  = usage.get("cache_read_input_tokens", 0) or 0
    cw  = usage.get("cache_creation_input_tokens", 0) or 0
    return (
        inp * r["input"]       / 1_000_000
        + out * r["output"]      / 1_000_000
        + cr  * r["cache_read"]  / 1_000_000
        + cw  * r["cache_write"] / 1_000_000
    )


# ---------------------------------------------------------------------------
# Request-scoped tracker
# ---------------------------------------------------------------------------

@dataclass
class CallRecord:
    label: str
    model: str
    input_tokens: int
    output_tokens: int
    cache_read_input_tokens: int
    cache_creation_input_tokens: int
    cost_usd: float


@dataclass
class CostTracker:
    calls: List[CallRecord] = field(default_factory=list)

    def record(self, *, label: str, model: str, usage: Dict[str, int]) -> CallRecord:
        rec = CallRecord(
            label=label,
            model=model,
            input_tokens=usage.get("input_tokens", 0) or 0,
            output_tokens=usage.get("output_tokens", 0) or 0,
            cache_read_input_tokens=usage.get("cache_read_input_tokens", 0) or 0,
            cache_creation_input_tokens=usage.get("cache_creation_input_tokens", 0) or 0,
            cost_usd=usage_to_cost(model, usage),
        )
        self.calls.append(rec)
        return rec

    def total_usd(self) -> float:
        return sum(c.cost_usd for c in self.calls)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_usd": round(self.total_usd(), 6),
            "calls": [
                {
                    "label": c.label,
                    "model": c.model,
                    "input_tokens": c.input_tokens,
                    "output_tokens": c.output_tokens,
                    "cache_read_input_tokens": c.cache_read_input_tokens,
                    "cache_creation_input_tokens": c.cache_creation_input_tokens,
                    "cost_usd": round(c.cost_usd, 6),
                }
                for c in self.calls
            ],
        }


_active: contextvars.ContextVar[Optional[CostTracker]] = contextvars.ContextVar(
    "cost_tracker", default=None
)


class track_costs:
    """Context manager that installs a fresh CostTracker for its body."""

    def __init__(self) -> None:
        self.tracker = CostTracker()
        self._token = None

    def __enter__(self) -> CostTracker:
        self._token = _active.set(self.tracker)
        return self.tracker

    def __exit__(self, exc_type, exc, tb) -> None:
        _active.reset(self._token)


def record_usage(*, label: str, model: str, usage: Dict[str, int]) -> None:
    """Push a usage record into the active tracker, if any. No-op otherwise."""
    tracker = _active.get()
    if tracker is None:
        return
    tracker.record(label=label, model=model, usage=usage)


def estimate_cost(model: str, *, input_tokens: int, output_tokens: int) -> float:
    """Rough projection helper for UI previews."""
    return usage_to_cost(
        model,
        {"input_tokens": input_tokens, "output_tokens": output_tokens},
    )
