"""
FastAPI backend for the interactive conversation highlighting tool.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, HTTPException, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from config import (  # noqa: E402
    ANTHROPIC_SNIPPET_MODEL,
    ANTHROPIC_SPAN_MODEL,
    DEFAULT_PROMPT_TEMPLATE,
    DEFAULT_HIGHLIGHT_DEFINITION,
    DEFAULT_CONVERSATION_CONTEXT,
    DEFAULT_THEME_CONDITIONING,
    END_TO_END,
    DEFAULT_THRESHOLD,
    SAVED_HIGHLIGHTS_DIR,
    ensure_data_dirs,
    require_anthropic_key,
)
from pricing import (  # noqa: E402
    PRICING_USD_PER_MTOK,
    estimate_cost,
    rates_for,
    track_costs,
)
from transcript_processor import (  # noqa: E402
    list_conversations, load_conversation,
)
from prompt_builder import (  # noqa: E402
    build_full_prompt, build_preview_prompt,
    build_modular_prompt, build_modular_preview_prompt,
)
from highlight_detector import (  # noqa: E402
    call_llm,
    list_prediction_files,
    load_prediction_file,
    save_predictions,
    unmerge_scores,
)
from span_detector import (  # noqa: E402
    build_span_prompt,
    call_llm_spans,
    group_above_threshold,
    list_span_prediction_files,
    load_span_prediction_file,
    resolve_all_highlights,
    save_span_predictions,
)

require_anthropic_key()
ensure_data_dirs()

# Ensure DB schema exists before any route can hit it.
from db import get_engine  # noqa: E402
get_engine()

from routes_corpus import router as corpus_router  # noqa: E402
from routes_anthology import router as anthology_router  # noqa: E402

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(corpus_router)
app.include_router(anthology_router)

_conversation_cache: dict = {}


def _get_conversation(conversation_id: str) -> dict:
    if conversation_id not in _conversation_cache:
        _conversation_cache[conversation_id] = load_conversation(conversation_id)
    return _conversation_cache[conversation_id]


# ------------------------------------------------------------------
# API routes
# ------------------------------------------------------------------

@app.get("/api/conversations")
def api_list_conversations():
    return list_conversations()


@app.get("/api/conversations/{conversation_id}/transcript")
def api_get_transcript(conversation_id: str):
    try:
        data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return data


@app.get("/api/conversations/{conversation_id}/predictions")
def api_list_predictions(conversation_id: str):
    files = list_prediction_files(conversation_id)
    return files


@app.get("/api/conversations/{conversation_id}/predictions/{filename}")
def api_get_prediction(conversation_id: str, filename: str):
    try:
        conv_data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        raw_predictions = load_prediction_file(conversation_id, filename)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    scores_list = raw_predictions.get("paragraph_scores", [])
    original_scores = unmerge_scores(
        scores_list,
        conv_data["merge_mapping"],
        len(conv_data["original_snippets"]),
    )
    return {
        "filename": filename,
        "scores": original_scores,
    }


@app.post("/api/conversations/{conversation_id}/preview-prompt")
async def api_preview_prompt(conversation_id: str, request: Request):
    body = await request.json()
    prompt_template = body.get("prompt_template", DEFAULT_PROMPT_TEMPLATE)

    try:
        conv_data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    merged = conv_data["merged_snippets"]
    preview = build_preview_prompt(prompt_template, merged, preview_count=10)
    full = build_full_prompt(prompt_template, merged)

    return {
        "preview_prompt": preview,
        "full_prompt_length": len(full),
        "num_merged_snippets": len(merged),
    }


@app.post("/api/conversations/{conversation_id}/detect-highlights")
async def api_detect_highlights(conversation_id: str, request: Request):
    body = await request.json()
    prompt_template = body.get("prompt_template", DEFAULT_PROMPT_TEMPLATE)

    try:
        conv_data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    merged = conv_data["merged_snippets"]
    full_prompt = build_full_prompt(prompt_template, merged)

    try:
        raw_result = call_llm(full_prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e}")

    saved_filename = save_predictions(conversation_id, raw_result)

    scores_list = raw_result.get("paragraph_scores", [])
    original_scores = unmerge_scores(
        scores_list,
        conv_data["merge_mapping"],
        len(conv_data["original_snippets"]),
    )

    return {
        "filename": saved_filename,
        "scores": original_scores,
    }


@app.post("/api/conversations/{conversation_id}/highlights/save")
async def api_save_highlights(conversation_id: str, request: Request):
    body = await request.json()
    highlights = body.get("highlights", [])
    metadata = body.get("metadata", None)

    conv_dir = SAVED_HIGHLIGHTS_DIR / conversation_id
    conv_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"highlights_{ts}.json"
    output_path = conv_dir / filename

    payload = {
        "conversation_id": conversation_id,
        "timestamp": ts,
        "highlights": highlights,
    }
    if metadata:
        payload["metadata"] = metadata

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    return {"filename": filename}


@app.get("/api/default-prompt")
def api_default_prompt():
    return {"prompt_template": DEFAULT_PROMPT_TEMPLATE}


# ------------------------------------------------------------------
# End-to-end pipeline routes
# ------------------------------------------------------------------

@app.get("/api/config")
def api_config():
    return {
        "end_to_end": END_TO_END,
        "default_threshold": DEFAULT_THRESHOLD,
    }


@app.get("/api/pricing")
def api_pricing():
    """Per-model rates + the model assignment for each pipeline pass.

    The frontend uses this to project a cost before the user runs the pipeline.
    """
    return {
        "rates_usd_per_mtok": PRICING_USD_PER_MTOK,
        "models": {
            "pass1_snippet": ANTHROPIC_SNIPPET_MODEL,
            "pass2_span": ANTHROPIC_SPAN_MODEL,
        },
    }


@app.post("/api/conversations/{conversation_id}/cost-estimate")
async def api_cost_estimate(conversation_id: str, request: Request):
    """Cheap projection used by the run modal: ~chars/4 for input tokens,
    plus a fixed output budget per pass. No Anthropic call is made."""
    body = await request.json()
    highlight_def = body.get("highlight_definition", DEFAULT_HIGHLIGHT_DEFINITION)
    conv_context = body.get("conversation_context", DEFAULT_CONVERSATION_CONTEXT)
    theme_cond = body.get("theme_conditioning", "")
    pass1_model = body.get("pass1_model") or ANTHROPIC_SNIPPET_MODEL
    pass2_model = body.get("pass2_model") or ANTHROPIC_SPAN_MODEL

    try:
        conv_data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    merged = conv_data["merged_snippets"]
    full_prompt = build_modular_prompt(highlight_def, conv_context, theme_cond, merged)

    # Pass 1: full prompt in, ~80 output tokens per merged snippet (score+reason).
    p1_in = max(1, len(full_prompt) // 4)
    p1_out = max(512, 80 * len(merged))
    p1_cost = estimate_cost(pass1_model, input_tokens=p1_in, output_tokens=p1_out)

    # Pass 2 is data-dependent (only spans above threshold). Use a flat estimate
    # of ~25% of pass-1 inputs and 1500 output tokens.
    p2_in = max(1, p1_in // 4)
    p2_out = 1500
    p2_cost = estimate_cost(pass2_model, input_tokens=p2_in, output_tokens=p2_out)

    return {
        "pass1": {
            "model": pass1_model,
            "input_tokens": p1_in,
            "output_tokens": p1_out,
            "cost_usd": round(p1_cost, 6),
        },
        "pass2": {
            "model": pass2_model,
            "input_tokens": p2_in,
            "output_tokens": p2_out,
            "cost_usd": round(p2_cost, 6),
            "note": "rough — pass 2 only runs on snippets above threshold",
        },
        "total_usd": round(p1_cost + p2_cost, 6),
    }


@app.get("/api/prompt-components")
def api_prompt_components():
    return {
        "highlight_definition": DEFAULT_HIGHLIGHT_DEFINITION,
        "conversation_context": DEFAULT_CONVERSATION_CONTEXT,
        "theme_conditioning": DEFAULT_THEME_CONDITIONING,
    }


@app.post("/api/conversations/{conversation_id}/preview-prompt-modular")
async def api_preview_prompt_modular(conversation_id: str, request: Request):
    body = await request.json()
    highlight_def = body.get("highlight_definition", DEFAULT_HIGHLIGHT_DEFINITION)
    conv_context = body.get("conversation_context", DEFAULT_CONVERSATION_CONTEXT)
    theme_cond = body.get("theme_conditioning", "")

    try:
        conv_data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    merged = conv_data["merged_snippets"]
    preview = build_modular_preview_prompt(
        highlight_def, conv_context, theme_cond, merged, preview_count=10,
    )
    full = build_modular_prompt(highlight_def, conv_context, theme_cond, merged)

    return {
        "preview_prompt": preview,
        "full_prompt_length": len(full),
        "num_merged_snippets": len(merged),
    }


@app.post("/api/conversations/{conversation_id}/detect-highlights-e2e")
async def api_detect_highlights_e2e(conversation_id: str, request: Request):
    body = await request.json()
    highlight_def = body.get("highlight_definition", DEFAULT_HIGHLIGHT_DEFINITION)
    conv_context = body.get("conversation_context", DEFAULT_CONVERSATION_CONTEXT)
    theme_cond = body.get("theme_conditioning", "")
    pass1_model = body.get("pass1_model") or ANTHROPIC_SNIPPET_MODEL
    pass2_model = body.get("pass2_model") or ANTHROPIC_SPAN_MODEL

    try:
        conv_data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    merged = conv_data["merged_snippets"]
    original_snippets = conv_data["original_snippets"]
    full_prompt = build_modular_prompt(
        highlight_def, conv_context, theme_cond, merged,
    )

    with track_costs() as tracker:
        # --- Pass 1: snippet scoring ---
        try:
            raw_scores = call_llm(full_prompt, model=pass1_model)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Anthropic API error (pass 1): {e}")

        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        scores_filename = save_predictions(conversation_id, raw_scores, ts=ts)

        scores_list = raw_scores.get("paragraph_scores", [])
        original_scores = unmerge_scores(
            scores_list,
            conv_data["merge_mapping"],
            len(original_snippets),
        )

        # --- Threshold and group ---
        threshold = DEFAULT_THRESHOLD
        scores_for_grouping = [
            {"paragraph_index": s["snippet_index"], "score": s["score"]}
            for s in original_scores
        ]
        groups = group_above_threshold(
            scores_for_grouping, threshold, len(original_snippets),
        )

        if not groups:
            return {
                "snippet_scores_file": scores_filename,
                "span_predictions_file": None,
                "scores": original_scores,
                "highlights": [],
                "threshold": threshold,
                "cost": tracker.to_dict(),
            }

        # --- Pass 2: span extraction ---
        span_prompt = build_span_prompt(groups, original_snippets)
        try:
            raw_spans = call_llm_spans(span_prompt, model=pass2_model)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Anthropic API error (pass 2): {e}")

        highlights = resolve_all_highlights(
            raw_spans.get("highlights", []),
            original_snippets,
        )

        span_payload = {
            "conversation_id": conversation_id,
            "source_predictions_file": scores_filename,
            "threshold": threshold,
            "highlights": highlights,
        }
        span_filename = save_span_predictions(conversation_id, span_payload, ts=ts)

    return {
        "snippet_scores_file": scores_filename,
        "span_predictions_file": span_filename,
        "scores": original_scores,
        "highlights": highlights,
        "threshold": threshold,
        "cost": tracker.to_dict(),
    }


# ------------------------------------------------------------------
# Span-level (second-pass) routes
# ------------------------------------------------------------------

@app.post("/api/conversations/{conversation_id}/detect-spans")
async def api_detect_spans(conversation_id: str, request: Request):
    body = await request.json()
    predictions_file = body.get("predictions_file")
    threshold = body.get("threshold", 5)

    if not predictions_file:
        raise HTTPException(status_code=400, detail="predictions_file is required")

    try:
        conv_data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        raw_predictions = load_prediction_file(conversation_id, predictions_file)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    scores_list = raw_predictions.get("paragraph_scores", [])
    original_snippets = conv_data["original_snippets"]
    original_scores = unmerge_scores(
        scores_list,
        conv_data["merge_mapping"],
        len(original_snippets),
    )

    scores_for_grouping = [
        {"paragraph_index": s["snippet_index"], "score": s["score"]}
        for s in original_scores
    ]
    groups = group_above_threshold(
        scores_for_grouping, threshold, len(original_snippets),
    )

    if not groups:
        raise HTTPException(status_code=400, detail="No snippets above threshold")

    prompt = build_span_prompt(groups, original_snippets)

    try:
        raw_result = call_llm_spans(prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e}")

    highlights = resolve_all_highlights(
        raw_result.get("highlights", []),
        original_snippets,
    )

    payload = {
        "conversation_id": conversation_id,
        "source_predictions_file": predictions_file,
        "threshold": threshold,
        "highlights": highlights,
    }
    saved_filename = save_span_predictions(conversation_id, payload)

    return {
        "filename": saved_filename,
        "highlights": highlights,
    }


@app.get("/api/conversations/{conversation_id}/span-predictions")
def api_list_span_predictions(conversation_id: str):
    files = list_span_prediction_files(conversation_id)
    return files


@app.get("/api/conversations/{conversation_id}/span-predictions/{filename}")
def api_get_span_prediction(conversation_id: str, filename: str):
    try:
        data = load_span_prediction_file(conversation_id, filename)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return data


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
