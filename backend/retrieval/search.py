"""
Search over a corpus's per-snippet style and topic vectors.

- `score_query(corpus_id, style_query, topic_query, blend)` -> per-snippet
  dict of {style_score, topic_score, fused_score}. Grey-out mapping is
  computed downstream on the frontend.

- `score_signature(corpus_id, snippet_ids)` -> per-snippet "more like this"
  scores from the averaged signature of the selected snippets.

Cosine similarity is computed against per-corpus .npy matrices loaded
on demand.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
from sqlmodel import select

from config import STYLE_EMBED_DIM, TOPIC_EMBED_DIM, VECTORS_DIR
from db import Snippet, session


def _load_matrix(corpus_id: int, kind: str, dim: int) -> np.ndarray:
    path = VECTORS_DIR / str(corpus_id) / f"{kind}.npy"
    if not path.is_file():
        return np.zeros((0, dim), dtype=np.float32)
    return np.load(path)


def _cosine(query_vec: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Cosine similarity between (D,) query and (N, D) matrix -> (N,)."""
    if matrix.shape[0] == 0:
        return np.zeros(0, dtype=np.float32)
    q = query_vec.astype(np.float32)
    q_norm = np.linalg.norm(q) + 1e-8
    m_norms = np.linalg.norm(matrix, axis=1) + 1e-8
    return (matrix @ q) / (m_norms * q_norm)


def _to_unit_range(scores: np.ndarray) -> np.ndarray:
    """Map cosine scores (which may be in [-1, 1]) to [0, 1]."""
    return np.clip((scores + 1.0) * 0.5, 0.0, 1.0)


def _rrf_scores(rank_lists: List[np.ndarray], k: int = 60) -> np.ndarray:
    """Reciprocal rank fusion over arrays of per-row scores."""
    n = rank_lists[0].shape[0] if rank_lists else 0
    if n == 0:
        return np.zeros(0, dtype=np.float32)
    total = np.zeros(n, dtype=np.float32)
    for sc in rank_lists:
        order = np.argsort(-sc)  # descending
        rank = np.empty_like(order)
        rank[order] = np.arange(n)
        total += 1.0 / (k + rank + 1)
    # Normalize to [0, 1] for rendering.
    max_val = float(total.max()) if total.size else 1.0
    if max_val <= 0:
        return total
    return total / max_val


def score_query(
    corpus_id: int,
    style_query: str,
    topic_query: str,
    blend: float = 0.5,
    fusion: str = "rrf",
) -> List[Dict]:
    """
    Score every snippet in the corpus against (style_query, topic_query).

    Returns a list of dicts, one per snippet, ordered the same as the
    Snippet rows for that corpus, with fields:
        snippet_id, conversation_id, idx, start_sec, end_sec, text,
        style_score, topic_score, fused_score

    `blend` ranges 0..1: 0 = pure topic, 1 = pure style. Only used for
    the "weighted" fusion mode; RRF ignores it.
    """
    # Load matrices + conversation/snippet rows.
    style_mat = _load_matrix(corpus_id, "style", STYLE_EMBED_DIM)
    topic_mat = _load_matrix(corpus_id, "topic", TOPIC_EMBED_DIM)

    from db import Conversation
    with session() as s:
        conv_ids = set(
            c.id for c in s.exec(
                select(Conversation).where(Conversation.corpus_id == corpus_id)
            ).all()
        )
        all_rows = list(s.exec(select(Snippet)).all())
        rows = [r for r in all_rows if r.conversation_id in conv_ids]

    # Compute per-axis scores.
    style_scores = np.zeros(len(rows), dtype=np.float32)
    topic_scores = np.zeros(len(rows), dtype=np.float32)

    if style_query and style_mat.shape[0] > 0:
        from encoders import style as style_enc
        if style_enc.is_available():
            sq = style_enc.embed_text_query(style_query)
            full = _to_unit_range(_cosine(sq, style_mat))
            for i, row in enumerate(rows):
                if row.style_row is not None and row.style_row < len(full):
                    style_scores[i] = float(full[row.style_row])

    if topic_query and topic_mat.shape[0] > 0:
        from encoders import topic as topic_enc
        tq = topic_enc.embed_one(topic_query)
        full = _to_unit_range(_cosine(tq, topic_mat))
        for i, row in enumerate(rows):
            if row.topic_row is not None and row.topic_row < len(full):
                topic_scores[i] = float(full[row.topic_row])

    # Fuse.
    has_style = style_query != ""
    has_topic = topic_query != ""
    if has_style and has_topic:
        if fusion == "rrf":
            fused = _rrf_scores([style_scores, topic_scores])
        elif fusion == "max":
            fused = np.maximum(style_scores, topic_scores)
        else:  # weighted
            fused = blend * style_scores + (1 - blend) * topic_scores
    elif has_style:
        fused = style_scores
    elif has_topic:
        fused = topic_scores
    else:
        fused = np.zeros(len(rows), dtype=np.float32)

    return [
        {
            "snippet_id": r.id,
            "conversation_id": r.conversation_id,
            "idx": r.idx,
            "start_sec": r.start_sec,
            "end_sec": r.end_sec,
            "text": r.text,
            "style_score": float(style_scores[i]),
            "topic_score": float(topic_scores[i]),
            "fused_score": float(fused[i]),
        }
        for i, r in enumerate(rows)
    ]


def score_signature(corpus_id: int, snippet_ids: List[int]) -> List[Dict]:
    """
    Compute an averaged signature from the given snippets and score every
    snippet in the corpus against it.
    """
    if not snippet_ids:
        return []
    style_mat = _load_matrix(corpus_id, "style", STYLE_EMBED_DIM)
    topic_mat = _load_matrix(corpus_id, "topic", TOPIC_EMBED_DIM)

    from db import Conversation
    with session() as s:
        sid_set = set(snippet_ids)
        conv_ids = set(
            c.id for c in s.exec(
                select(Conversation).where(Conversation.corpus_id == corpus_id)
            ).all()
        )
        every_snip = list(s.exec(select(Snippet)).all())
        rows = [r for r in every_snip if r.id in sid_set]
        all_rows = [r for r in every_snip if r.conversation_id in conv_ids]

    # Averaged signatures (if all rows have the vectors).
    style_sig = None
    topic_sig = None
    style_rows = [r.style_row for r in rows if r.style_row is not None]
    topic_rows = [r.topic_row for r in rows if r.topic_row is not None]
    if style_rows and style_mat.shape[0] > 0:
        style_sig = style_mat[style_rows].mean(axis=0)
    if topic_rows and topic_mat.shape[0] > 0:
        topic_sig = topic_mat[topic_rows].mean(axis=0)

    style_scores = np.zeros(len(all_rows), dtype=np.float32)
    topic_scores = np.zeros(len(all_rows), dtype=np.float32)
    if style_sig is not None:
        full = _to_unit_range(_cosine(style_sig, style_mat))
        for i, r in enumerate(all_rows):
            if r.style_row is not None and r.style_row < len(full):
                style_scores[i] = float(full[r.style_row])
    if topic_sig is not None:
        full = _to_unit_range(_cosine(topic_sig, topic_mat))
        for i, r in enumerate(all_rows):
            if r.topic_row is not None and r.topic_row < len(full):
                topic_scores[i] = float(full[r.topic_row])

    fused = _rrf_scores([style_scores, topic_scores]) if (
        style_sig is not None and topic_sig is not None
    ) else (style_scores if style_sig is not None else topic_scores)

    return [
        {
            "snippet_id": r.id,
            "conversation_id": r.conversation_id,
            "idx": r.idx,
            "start_sec": r.start_sec,
            "end_sec": r.end_sec,
            "text": r.text,
            "style_score": float(style_scores[i]),
            "topic_score": float(topic_scores[i]),
            "fused_score": float(fused[i]),
        }
        for i, r in enumerate(all_rows)
    ]
