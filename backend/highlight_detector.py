"""
OpenAI API interaction for highlight detection, score un-merging, and
prediction persistence.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from openai import OpenAI

from config import OPENAI_MODEL, PREDICTIONS_CACHE_DIR

JSON_SCHEMA = {
    "name": "paragraph_scores",
    "schema": {
        "type": "object",
        "properties": {
            "paragraph_scores": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "paragraph_index": {"type": "integer"},
                        "reasoning": {"type": "string"},
                        "highlight_score": {"type": "integer"},
                    },
                    "required": ["paragraph_index", "reasoning", "highlight_score"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["paragraph_scores"],
        "additionalProperties": False,
    },
    "strict": True,
}


def call_openai(
    prompt_text: str,
    model: Optional[str] = None,
) -> Dict:
    """
    Send the assembled prompt to the OpenAI API and return the parsed
    paragraph_scores dict.
    """
    model = model or OPENAI_MODEL
    client = OpenAI()
    response = client.chat.completions.parse(
        model=model,
        messages=[{"role": "user", "content": prompt_text}],
        response_format={
            "type": "json_schema",
            "json_schema": JSON_SCHEMA,
        },
    )
    return json.loads(response.choices[0].message.content)


def unmerge_scores(
    paragraph_scores: List[Dict],
    merge_mapping: Dict[str, List[int]],
    num_original_snippets: int,
) -> List[Dict]:
    """
    Map merged-snippet scores back to original (un-merged) snippet indices.

    Each original snippet inherits the score and reasoning of the merged
    snippet it belongs to.  The ``paragraph_scores`` list may use either
    ``highlight_score`` or ``score`` as the score key (both conventions
    appear in existing cache files).
    """
    merged_to_score: Dict[int, Dict] = {}
    for entry in paragraph_scores:
        m_idx = entry["paragraph_index"]
        score = entry.get("highlight_score", entry.get("score", 0))
        merged_to_score[m_idx] = {
            "reasoning": entry.get("reasoning", ""),
            "score": score,
        }

    original_scores: List[Dict] = []
    merged_idx_for_orig: Dict[int, int] = {}
    for m_idx_str, orig_indices in merge_mapping.items():
        m_idx = int(m_idx_str)
        for o_idx in orig_indices:
            merged_idx_for_orig[o_idx] = m_idx

    for o_idx in range(num_original_snippets):
        m_idx = merged_idx_for_orig.get(o_idx)
        if m_idx is not None and m_idx in merged_to_score:
            info = merged_to_score[m_idx]
            original_scores.append({
                "snippet_index": o_idx,
                "merged_index": m_idx,
                "score": info["score"],
                "reasoning": info["reasoning"],
            })
        else:
            original_scores.append({
                "snippet_index": o_idx,
                "merged_index": m_idx,
                "score": 0,
                "reasoning": "",
            })

    return original_scores


def save_predictions(
    conversation_id: str,
    predictions: Dict,
    cache_dir: Optional[Path] = None,
) -> str:
    """
    Save raw LLM predictions to the cache directory with a timestamp filename.
    Returns the filename (not full path).
    """
    cache_dir = cache_dir or PREDICTIONS_CACHE_DIR
    conv_dir = cache_dir / conversation_id
    conv_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"predictions_{ts}.json"
    output_path = conv_dir / filename

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(predictions, f, indent=2, ensure_ascii=False)

    return filename


def list_prediction_files(conversation_id: str) -> List[str]:
    """List all prediction JSON filenames for a conversation."""
    conv_dir = PREDICTIONS_CACHE_DIR / conversation_id
    if not conv_dir.exists():
        return []
    return sorted(p.name for p in conv_dir.glob("*.json"))


def load_prediction_file(conversation_id: str, filename: str) -> Dict:
    """Load and return the contents of a prediction JSON file."""
    path = PREDICTIONS_CACHE_DIR / conversation_id / filename
    if not path.exists():
        raise FileNotFoundError(f"Prediction file not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)
