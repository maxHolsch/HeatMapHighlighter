"""
Transcript loading, cleaning, and snippet merging with index mapping.

Replicates the cleaning logic from data/cortico/clean_cortico_jsons.py and
the merge logic from highlight-extraction/utils.py, adding original-index
tracking so that merged-snippet LLM scores can be mapped back to the
original (un-merged) snippet list.
"""

import json
import re
from typing import Dict, List, Optional, Tuple

from sqlmodel import select

from config import RAW_TRANSCRIPTS_DIR
from db import Conversation, Snippet, session


# ---------------------------------------------------------------------------
# Cleaning
# ---------------------------------------------------------------------------

def clean_raw_transcript(raw_json: dict) -> List[Dict]:
    """
    Turn a raw Cortico transcript JSON into a flat list of cleaned snippets.

    Each output snippet has:
        audio_start_offset, audio_end_offset, speaker_id, speaker_name, transcript
    """
    cleaned = []
    for snippet in raw_json.get("snippets", []):
        text = " ".join(w["word"] for w in snippet.get("words", []))
        cleaned.append({
            "audio_start_offset": snippet.get("audio_start_offset"),
            "audio_end_offset": snippet.get("audio_end_offset"),
            "speaker_id": snippet.get("speaker_id"),
            "speaker_name": snippet.get("speaker_name"),
            "transcript": text.strip(),
        })
    return cleaned


# ---------------------------------------------------------------------------
# Sentence counting & snippet-pair merging (ported from utils.py)
# ---------------------------------------------------------------------------

def _count_sentences(text: str) -> int:
    if not text or not text.strip():
        return 0
    matches = re.findall(r"[.!?]+", text)
    return max(len(matches), 1)


def _merge_pair(a: Dict, b: Dict) -> Dict:
    merged = dict(a)
    merged["audio_end_offset"] = b["audio_end_offset"]
    merged["transcript"] = a["transcript"].rstrip() + " " + b["transcript"].lstrip()
    merged["_orig_indices"] = a["_orig_indices"] + b["_orig_indices"]
    return merged


def _merge_short_in_turn(snippets: List[Dict]) -> List[Dict]:
    if not snippets:
        return []

    # Pass 1: merge consecutive runs of 1-sentence snippets
    result: List[Dict] = []
    i = 0
    while i < len(snippets):
        if _count_sentences(snippets[i]["transcript"]) == 1:
            run_end = i + 1
            while (
                run_end < len(snippets)
                and _count_sentences(snippets[run_end]["transcript"]) == 1
            ):
                run_end += 1
            merged = snippets[i]
            for j in range(i + 1, run_end):
                merged = _merge_pair(merged, snippets[j])
            result.append(merged)
            i = run_end
        else:
            result.append(snippets[i])
            i += 1

    # Pass 2: iteratively merge remaining isolated 1-sentence snippets
    changed = True
    while changed and len(result) > 1:
        changed = False
        new_result: List[Dict] = []
        i = 0
        while i < len(result):
            if _count_sentences(result[i]["transcript"]) == 1:
                changed = True
                if i + 1 < len(result):
                    new_result.append(_merge_pair(result[i], result[i + 1]))
                    i += 2
                else:
                    prev = new_result.pop()
                    new_result.append(_merge_pair(prev, result[i]))
                    i += 1
            else:
                new_result.append(result[i])
                i += 1
        result = new_result

    return result


def _merge_short_snippets(snippets: List[Dict]) -> List[Dict]:
    if not snippets:
        return []

    runs: List[List[Dict]] = []
    current_run: List[Dict] = [snippets[0]]
    for snippet in snippets[1:]:
        if snippet["speaker_id"] == current_run[-1]["speaker_id"]:
            current_run.append(snippet)
        else:
            runs.append(current_run)
            current_run = [snippet]
    runs.append(current_run)

    merged: List[Dict] = []
    for run in runs:
        merged.extend(_merge_short_in_turn(run))
    return merged


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def merge_snippets_with_mapping(
    cleaned_snippets: List[Dict],
) -> Tuple[List[Dict], Dict[int, List[int]]]:
    """
    Merge short snippets and return both the merged list and a mapping
    from each merged-snippet index to original-snippet indices.
    """
    for i, s in enumerate(cleaned_snippets):
        s["_orig_indices"] = [i]

    merged = _merge_short_snippets(cleaned_snippets)

    mapping: Dict[int, List[int]] = {}
    for m_idx, snippet in enumerate(merged):
        mapping[m_idx] = snippet.pop("_orig_indices")

    # Also strip from originals (they were mutated in-place)
    for s in cleaned_snippets:
        s.pop("_orig_indices", None)

    return merged, mapping


def _load_from_db(conversation_id: str) -> Tuple[List[Dict], Optional[Dict]]:
    """Pull snippets for a conversation (looked up by title) from the corpus DB.

    Returns (snippets, meta) — meta carries db_id/audio info for the FE.
    """
    with session() as s:
        conv = s.exec(
            select(Conversation).where(Conversation.title == conversation_id)
        ).first()
        if conv is None:
            return [], None
        rows = s.exec(
            select(Snippet)
            .where(Snippet.conversation_id == conv.id)
            .order_by(Snippet.idx)
        ).all()
        snippets = [
            {
                "audio_start_offset": r.start_sec,
                "audio_end_offset": r.end_sec,
                "speaker_id": r.speaker_id,
                "speaker_name": r.speaker_name,
                "transcript": (r.text or "").strip(),
            }
            for r in rows
        ]
        meta = {
            "db_id": conv.id,
            "has_audio": bool(conv.audio_path),
            "duration_sec": conv.duration_sec,
        }
        return snippets, meta


def load_conversation(conversation_id: str) -> Dict:
    """
    Load a transcript (preferring the corpus DB, falling back to raw Cortico
    JSON), clean it, merge short snippets, and return everything the frontend
    and LLM pipeline need.
    """
    original_snippets, db_meta = _load_from_db(conversation_id)

    if not original_snippets:
        raw_path = RAW_TRANSCRIPTS_DIR / f"{conversation_id}.json"
        if not raw_path.exists():
            raise FileNotFoundError(
                f"Conversation {conversation_id!r} not found in corpus DB or "
                f"raw transcripts dir ({RAW_TRANSCRIPTS_DIR})."
            )
        with raw_path.open("r", encoding="utf-8") as f:
            raw_json = json.load(f)
        original_snippets = clean_raw_transcript(raw_json)

    merged_snippets, merge_mapping = merge_snippets_with_mapping(
        [dict(s) for s in original_snippets]  # copy so originals stay clean
    )

    payload: Dict = {
        "original_snippets": original_snippets,
        "merged_snippets": merged_snippets,
        "merge_mapping": {str(k): v for k, v in merge_mapping.items()},
    }
    if db_meta is not None:
        payload.update(db_meta)
    return payload


def list_conversations() -> List[str]:
    """Return sorted list of conversation IDs.

    Sources, in order: titles from the corpus DB (audio-ingested episodes),
    then any raw Cortico JSON stems on disk. Deduplicated.
    """
    ids: List[str] = []
    seen = set()

    try:
        with session() as s:
            titles = s.exec(select(Conversation.title)).all()
        for t in titles:
            if t and t not in seen:
                seen.add(t)
                ids.append(t)
    except Exception:
        # DB not yet initialised — fall back to filesystem only.
        pass

    if RAW_TRANSCRIPTS_DIR.exists():
        for p in RAW_TRANSCRIPTS_DIR.glob("conversation-*.json"):
            if p.stem not in seen:
                seen.add(p.stem)
                ids.append(p.stem)

    return sorted(ids)
