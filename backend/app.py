"""
Flask backend for the interactive conversation highlighting tool.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from flask import Flask, jsonify, request  # noqa: E402
from flask_cors import CORS  # noqa: E402

from config import DEFAULT_PROMPT_TEMPLATE, SAVED_HIGHLIGHTS_DIR  # noqa: E402
from transcript_processor import (  # noqa: E402
    list_conversations, load_conversation,
)
from prompt_builder import (  # noqa: E402
    build_full_prompt, build_preview_prompt,
)
from highlight_detector import (  # noqa: E402
    call_openai,
    list_prediction_files,
    load_prediction_file,
    save_predictions,
    unmerge_scores,
)
from span_detector import (  # noqa: E402
    build_span_prompt,
    call_openai_spans,
    group_above_threshold,
    list_span_prediction_files,
    load_span_prediction_file,
    resolve_all_highlights,
    save_span_predictions,
)

app = Flask(__name__)
CORS(app)

# In-memory cache so we don't re-clean the same transcript on every request.
_conversation_cache: dict = {}


def _get_conversation(conversation_id: str) -> dict:
    if conversation_id not in _conversation_cache:
        _conversation_cache[conversation_id] = load_conversation(conversation_id)
    return _conversation_cache[conversation_id]


# ------------------------------------------------------------------
# API routes
# ------------------------------------------------------------------

@app.route("/api/conversations", methods=["GET"])
def api_list_conversations():
    return jsonify(list_conversations())


@app.route("/api/conversations/<conversation_id>/transcript", methods=["GET"])
def api_get_transcript(conversation_id: str):
    try:
        data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify(data)


@app.route("/api/conversations/<conversation_id>/predictions", methods=["GET"])
def api_list_predictions(conversation_id: str):
    files = list_prediction_files(conversation_id)
    return jsonify(files)


@app.route(
    "/api/conversations/<conversation_id>/predictions/<filename>",
    methods=["GET"],
)
def api_get_prediction(conversation_id: str, filename: str):
    try:
        conv_data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

    try:
        raw_predictions = load_prediction_file(conversation_id, filename)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

    scores_list = raw_predictions.get("paragraph_scores", [])
    original_scores = unmerge_scores(
        scores_list,
        conv_data["merge_mapping"],
        len(conv_data["original_snippets"]),
    )
    return jsonify({
        "filename": filename,
        "scores": original_scores,
    })


@app.route(
    "/api/conversations/<conversation_id>/preview-prompt",
    methods=["POST"],
)
def api_preview_prompt(conversation_id: str):
    body = request.get_json(force=True)
    prompt_template = body.get("prompt_template", DEFAULT_PROMPT_TEMPLATE)

    try:
        conv_data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

    merged = conv_data["merged_snippets"]
    preview = build_preview_prompt(prompt_template, merged, preview_count=10)
    full = build_full_prompt(prompt_template, merged)

    return jsonify({
        "preview_prompt": preview,
        "full_prompt_length": len(full),
        "num_merged_snippets": len(merged),
    })


@app.route(
    "/api/conversations/<conversation_id>/detect-highlights",
    methods=["POST"],
)
def api_detect_highlights(conversation_id: str):
    body = request.get_json(force=True)
    prompt_template = body.get("prompt_template", DEFAULT_PROMPT_TEMPLATE)

    try:
        conv_data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

    merged = conv_data["merged_snippets"]
    full_prompt = build_full_prompt(prompt_template, merged)

    try:
        raw_result = call_openai(full_prompt)
    except Exception as e:
        return jsonify({"error": f"OpenAI API error: {e}"}), 502

    saved_filename = save_predictions(conversation_id, raw_result)

    scores_list = raw_result.get("paragraph_scores", [])
    original_scores = unmerge_scores(
        scores_list,
        conv_data["merge_mapping"],
        len(conv_data["original_snippets"]),
    )

    # Invalidate prediction-file list cache (not cached, but clear conv cache
    # so merge_mapping stays fresh if transcript changes in the future)

    return jsonify({
        "filename": saved_filename,
        "scores": original_scores,
    })


@app.route(
    "/api/conversations/<conversation_id>/highlights/save",
    methods=["POST"],
)
def api_save_highlights(conversation_id: str):
    body = request.get_json(force=True)
    highlights = body.get("highlights", [])

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

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    return jsonify({"filename": filename})


@app.route("/api/default-prompt", methods=["GET"])
def api_default_prompt():
    return jsonify({"prompt_template": DEFAULT_PROMPT_TEMPLATE})


# ------------------------------------------------------------------
# Span-level (second-pass) routes
# ------------------------------------------------------------------

@app.route(
    "/api/conversations/<conversation_id>/detect-spans",
    methods=["POST"],
)
def api_detect_spans(conversation_id: str):
    body = request.get_json(force=True)
    predictions_file = body.get("predictions_file")
    threshold = body.get("threshold", 5)

    if not predictions_file:
        return jsonify({"error": "predictions_file is required"}), 400

    try:
        conv_data = _get_conversation(conversation_id)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

    try:
        raw_predictions = load_prediction_file(conversation_id, predictions_file)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

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
        return jsonify({"error": "No snippets above threshold"}), 400

    prompt = build_span_prompt(groups, original_snippets)

    try:
        raw_result = call_openai_spans(prompt)
    except Exception as e:
        return jsonify({"error": f"OpenAI API error: {e}"}), 502

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

    return jsonify({
        "filename": saved_filename,
        "highlights": highlights,
    })


@app.route(
    "/api/conversations/<conversation_id>/span-predictions",
    methods=["GET"],
)
def api_list_span_predictions(conversation_id: str):
    files = list_span_prediction_files(conversation_id)
    return jsonify(files)


@app.route(
    "/api/conversations/<conversation_id>/span-predictions/<filename>",
    methods=["GET"],
)
def api_get_span_prediction(conversation_id: str, filename: str):
    try:
        data = load_span_prediction_file(conversation_id, filename)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify(data)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
