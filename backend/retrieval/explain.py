"""
One-line "why salient" explanations for a snippet under a given query.

Cached by (snippet_id, query_hash) in the Explanation table.
"""

from __future__ import annotations

import hashlib
from typing import Optional

from sqlmodel import select

from config import ANTHROPIC_EXPLAIN_MODEL
from db import Conversation, Explanation, Snippet, session
from llm_client import run_text


def query_hash(style: str, topic: str) -> str:
    h = hashlib.sha256(f"{style}||{topic}".encode("utf-8")).hexdigest()
    return h[:16]


def explain(
    snippet_id: int,
    style: str = "",
    topic: str = "",
    style_score: float = 0.0,
    topic_score: float = 0.0,
) -> str:
    qh = query_hash(style, topic)

    with session() as s:
        cached = s.exec(
            select(Explanation).where(
                Explanation.snippet_id == snippet_id,
                Explanation.query_hash == qh,
            )
        ).first()
        if cached:
            return cached.text
        snip = s.get(Snippet, snippet_id)
        if not snip:
            return ""
        conv = s.get(Conversation, snip.conversation_id)

    context = f"\nConversation: {conv.title if conv else ''}"
    query_desc = ""
    if style and topic:
        query_desc = f"Query axes — style: \"{style}\" (score {style_score:.2f}); topic: \"{topic}\" (score {topic_score:.2f})."
    elif style:
        query_desc = f"Query axis — style: \"{style}\" (score {style_score:.2f})."
    elif topic:
        query_desc = f"Query axis — topic: \"{topic}\" (score {topic_score:.2f})."
    else:
        query_desc = "No query provided; explain general salience."

    prompt = (
        f"{query_desc}\n"
        f"Snippet text: \"{snip.text}\"\n"
        f"{context}\n\n"
        "Write ONE short sentence (under 25 words) explaining why this "
        "snippet might be salient under the query. Reference specific "
        "content cues; do NOT speculate about vocal qualities you can't "
        "hear. If the query is about speaking style, note that the "
        "paralinguistic score is what suggests a match."
    )

    text = run_text(
        model=ANTHROPIC_EXPLAIN_MODEL,
        prompt=prompt,
        max_tokens=120,
        temperature=0.2,
    )

    with session() as s:
        s.add(Explanation(snippet_id=snippet_id, query_hash=qh, text=text))
        s.commit()
    return text
