"""
Second-pass span-level highlight detection.

Given snippet-level scores from the first pass, this module:
1. Groups consecutive above-threshold snippets into candidate groups
2. Builds a theme-agnostic prompt for precise boundary extraction
3. Calls the OpenAI API to get quoted-anchor span boundaries
4. Resolves the quoted anchors to per-snippet character offsets
5. Persists results to highlight_cache/
"""

import difflib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from config import ANTHROPIC_SPAN_MODEL, HIGHLIGHT_CACHE_DIR, SPAN_PROMPT_TEMPLATE
from llm_client import run_structured

SPAN_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "highlights": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start_snippet_index": {"type": "integer"},
                    "end_snippet_index": {"type": "integer"},
                    "start_quote": {"type": "string"},
                    "end_quote": {"type": "string"},
                    "reasoning": {"type": "string"},
                },
                "required": [
                    "start_snippet_index",
                    "end_snippet_index",
                    "start_quote",
                    "end_quote",
                    "reasoning",
                ],
            },
        }
    },
    "required": ["highlights"],
}


# ---------------------------------------------------------------------------
# Grouping
# ---------------------------------------------------------------------------

def group_above_threshold(
    scores: List[Dict],
    threshold: int,
    num_snippets: int,
    num_context: int = 1,
) -> List[Dict]:
    """
    Group consecutive above-threshold snippets into candidate groups.

    Each group contains:
      - candidate_indices: list of original snippet indices that are above threshold
      - context_before: up to `num_context` snippet indices immediately before
      - context_after: up to `num_context` snippet indices immediately after
    """
    above = set()
    for entry in scores:
        score = entry.get("highlight_score", entry.get("score", 0))
        if score >= threshold:
            above.add(entry["paragraph_index"])

    sorted_above = sorted(above)
    if not sorted_above:
        return []

    runs: List[List[int]] = []
    current_run = [sorted_above[0]]
    for idx in sorted_above[1:]:
        if idx == current_run[-1] + 1:
            current_run.append(idx)
        else:
            runs.append(current_run)
            current_run = [idx]
    runs.append(current_run)

    groups = []
    for run in runs:
        first, last = run[0], run[-1]
        ctx_before = list(range(max(0, first - num_context), first))
        ctx_after = list(range(last + 1, min(num_snippets, last + 1 + num_context)))
        groups.append({
            "candidate_indices": run,
            "context_before": ctx_before,
            "context_after": ctx_after,
        })

    return groups


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------

def _format_snippet(index: int, snippet: Dict, is_context: bool = False) -> str:
    tag = "[CONTEXT] " if is_context else ""
    return (
        f"<snippet>\n"
        f"<index> {index} </index>\n"
        f"<speaker> {snippet['speaker_name']} </speaker>\n"
        f"<tag> {tag}</tag>\n"
        f"<text> {snippet['transcript']} </text>\n"
        f"</snippet>"
    )


def build_span_prompt(
    groups: List[Dict],
    original_snippets: List[Dict],
) -> str:
    """Build the full second-pass prompt from candidate groups."""
    parts = []
    for g_idx, group in enumerate(groups):
        part_lines = [f"--- Group {g_idx + 1} ---"]
        for idx in group["context_before"]:
            part_lines.append(_format_snippet(idx, original_snippets[idx], is_context=True))
        for idx in group["candidate_indices"]:
            part_lines.append(_format_snippet(idx, original_snippets[idx], is_context=False))
        for idx in group["context_after"]:
            part_lines.append(_format_snippet(idx, original_snippets[idx], is_context=True))
        parts.append("\n\n".join(part_lines))

    formatted_groups = "\n\n\n".join(parts)
    return SPAN_PROMPT_TEMPLATE.replace("{formatted_groups}", formatted_groups)


# ---------------------------------------------------------------------------
# OpenAI API call
# ---------------------------------------------------------------------------

def call_llm_spans(
    prompt_text: str,
    model: Optional[str] = None,
    max_tokens: int = 8192,
) -> Dict:
    """Pass-2 span refinement. Returns {highlights: [...]}."""
    return run_structured(
        model=model or ANTHROPIC_SPAN_MODEL,
        prompt=prompt_text,
        tool_name="record_highlight_spans",
        tool_description=(
            "Record each precise highlight span as (start_snippet_index, "
            "end_snippet_index, verbatim start_quote, verbatim end_quote, "
            "reasoning)."
        ),
        input_schema=SPAN_TOOL_SCHEMA,
        max_tokens=max_tokens,
    )


# Backwards-compatible alias.
call_openai_spans = call_llm_spans


# ---------------------------------------------------------------------------
# Span boundary resolution
# ---------------------------------------------------------------------------

def _fuzzy_find(haystack: str, needle: str) -> int:
    """
    Find the best approximate match position of `needle` in `haystack`.
    Returns the start index of the best match, or 0 as last resort.
    """
    if not needle:
        return 0
    best_ratio = 0.0
    best_pos = 0
    n_len = len(needle)
    for i in range(len(haystack) - n_len + 1):
        window = haystack[i:i + n_len]
        ratio = difflib.SequenceMatcher(None, needle.lower(), window.lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_pos = i
            if ratio == 1.0:
                break
    if best_ratio < 0.5:
        return 0
    return best_pos


def resolve_span_boundaries(
    highlight: Dict,
    original_snippets: List[Dict],
) -> List[Dict]:
    """
    Resolve a single LLM highlight output (with quoted anchors) into
    per-snippet character offset spans.

    Returns a list of {snippet_index, char_start, char_end, text} dicts.
    """
    start_idx = highlight["start_snippet_index"]
    end_idx = highlight["end_snippet_index"]
    start_quote = highlight["start_quote"]
    end_quote = highlight["end_quote"]

    texts = []
    snippet_ranges: List[Tuple[int, int]] = []  # (global_start, global_end)
    pos = 0
    for idx in range(start_idx, end_idx + 1):
        t = original_snippets[idx]["transcript"]
        snippet_ranges.append((pos, pos + len(t)))
        texts.append(t)
        pos += len(t) + 1  # +1 for the joining space

    concatenated = " ".join(texts)

    start_pos = concatenated.find(start_quote)
    if start_pos == -1:
        start_pos = _fuzzy_find(concatenated, start_quote)

    end_match_pos = concatenated.find(end_quote)
    if end_match_pos == -1:
        end_match_pos = _fuzzy_find(concatenated, end_quote)
    end_pos = end_match_pos + len(end_quote)

    end_pos = min(end_pos, len(concatenated))
    if start_pos >= end_pos:
        start_pos = 0
        end_pos = len(concatenated)

    spans = []
    for i, idx in enumerate(range(start_idx, end_idx + 1)):
        snip_global_start, snip_global_end = snippet_ranges[i]
        span_start_in_snip = max(0, start_pos - snip_global_start)
        span_end_in_snip = min(
            snip_global_end - snip_global_start,
            end_pos - snip_global_start,
        )
        if span_start_in_snip < span_end_in_snip:
            snip_text = original_snippets[idx]["transcript"]
            spans.append({
                "snippet_index": idx,
                "char_start": span_start_in_snip,
                "char_end": span_end_in_snip,
                "text": snip_text[span_start_in_snip:span_end_in_snip],
            })

    return spans


def resolve_all_highlights(
    raw_highlights: List[Dict],
    original_snippets: List[Dict],
) -> List[Dict]:
    """
    Resolve all LLM highlight outputs into the final span format with IDs.
    """
    results = []
    for i, hl in enumerate(raw_highlights):
        spans = resolve_span_boundaries(hl, original_snippets)
        if not spans:
            continue
        full_text = " ".join(s["text"] for s in spans)
        results.append({
            "id": f"hl_{i}",
            "spans": spans,
            "full_text": full_text,
            "reasoning": hl.get("reasoning", ""),
            "status": "pending",
        })
    return results


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def save_span_predictions(
    conversation_id: str,
    data: Dict,
    cache_dir: Optional[Path] = None,
    ts: Optional[str] = None,
) -> str:
    """Save span predictions to cache. Returns the filename."""
    cache_dir = cache_dir or HIGHLIGHT_CACHE_DIR
    conv_dir = cache_dir / conversation_id
    conv_dir.mkdir(parents=True, exist_ok=True)

    ts = ts or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"spans_{ts}.json"
    output_path = conv_dir / filename

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return filename


def list_span_prediction_files(conversation_id: str) -> List[str]:
    """List span prediction filenames for a conversation."""
    conv_dir = HIGHLIGHT_CACHE_DIR / conversation_id
    if not conv_dir.exists():
        return []
    return sorted(p.name for p in conv_dir.glob("spans_*.json"))


def load_span_prediction_file(conversation_id: str, filename: str) -> Dict:
    """Load and return the contents of a span prediction JSON file."""
    path = HIGHLIGHT_CACHE_DIR / conversation_id / filename
    if not path.exists():
        raise FileNotFoundError(f"Span prediction file not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)
