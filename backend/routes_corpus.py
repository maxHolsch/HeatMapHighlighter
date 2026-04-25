"""
Corpus + conversation routes for the heatmap view.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlmodel import select

from audio.pipeline import ensure_corpus, ingest_transcript_only
from config import TRANSCRIPTS_DIR, find_audio_for
from db import Conversation, Corpus, Snippet, Word, session
from encoders import style as style_enc
from retrieval.explain import explain as explain_snippet
from retrieval.planner import plan as plan_query
from retrieval.search import score_query, score_signature

router = APIRouter(prefix="/api")


@router.post("/transcripts/{conversation_name}/register")
def register_transcript_conversation(conversation_name: str):
    """
    Register a transcript JSON as a DB Conversation so it can be referenced
    by clips in an anthology even when there's no audio corpus. Idempotent:
    if already registered in the default corpus, returns the id.
    """
    transcript_path = TRANSCRIPTS_DIR / f"{conversation_name}.json"
    if not transcript_path.is_file():
        raise HTTPException(status_code=404, detail=f"Transcript not found at {transcript_path}")
    corpus_id = ensure_corpus("transcripts-default", source_root=str(TRANSCRIPTS_DIR))
    with session() as s:
        existing = s.exec(
            select(Conversation).where(
                Conversation.corpus_id == corpus_id,
                Conversation.title == conversation_name,
            )
        ).first()
        if existing:
            return {"conversation_id": existing.id, "corpus_id": corpus_id}
    conv_id = ingest_transcript_only(corpus_id, conversation_name, str(transcript_path))
    return {"conversation_id": conv_id, "corpus_id": corpus_id}


@router.get("/corpora")
def list_corpora():
    with session() as s:
        rows = s.exec(select(Corpus).order_by(Corpus.created_at.desc())).all()  # type: ignore[attr-defined]
        out = []
        for c in rows:
            conv_count = len(s.exec(
                select(Conversation).where(Conversation.corpus_id == c.id)
            ).all())
            out.append({
                "id": c.id,
                "name": c.name,
                "source_root": c.source_root,
                "created_at": c.created_at.isoformat(),
                "num_conversations": conv_count,
            })
        return out


@router.get("/corpora/{corpus_id}/conversations")
def list_conversations_in_corpus(corpus_id: int):
    with session() as s:
        convs = list(s.exec(
            select(Conversation).where(Conversation.corpus_id == corpus_id).order_by(Conversation.title)  # type: ignore[attr-defined]
        ).all())
        return [
            {
                "id": c.id,
                "title": c.title,
                "transcript_id": c.transcript_id,
                "has_audio": bool(c.audio_path),
                "duration_sec": c.duration_sec,
                "num_snippets": c.num_snippets,
            }
            for c in convs
        ]


@router.get("/corpora/{corpus_id}/snippets")
def list_corpus_snippets(corpus_id: int):
    """Return every snippet in the corpus in conversation order for heatmap layout."""
    with session() as s:
        convs = list(s.exec(
            select(Conversation).where(Conversation.corpus_id == corpus_id).order_by(Conversation.title)  # type: ignore[attr-defined]
        ).all())
        out = []
        for conv in convs:
            snips = list(s.exec(
                select(Snippet).where(Snippet.conversation_id == conv.id).order_by(Snippet.idx)  # type: ignore[attr-defined]
            ).all())
            out.append({
                "conversation_id": conv.id,
                "title": conv.title,
                "has_audio": bool(conv.audio_path),
                "snippets": [
                    {
                        "snippet_id": sn.id,
                        "idx": sn.idx,
                        "start_sec": sn.start_sec,
                        "end_sec": sn.end_sec,
                        "text": sn.text,
                    }
                    for sn in snips
                ],
            })
        return {"conversations": out}


@router.post("/corpora/{corpus_id}/query")
async def corpus_query(corpus_id: int, request: Request):
    body = await request.json()
    raw_query = (body.get("query") or "").strip()
    style_q = (body.get("style") or "").strip()
    topic_q = (body.get("topic") or "").strip()
    blend = float(body.get("blend") or 0.5)
    fusion = body.get("fusion") or "rrf"

    rationale = ""
    # If the caller didn't provide explicit style/topic, plan from raw_query.
    if raw_query and not style_q and not topic_q:
        try:
            plan = plan_query(raw_query)
            style_q = plan["style"]
            topic_q = plan["topic"]
            rationale = plan["rationale"]
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Query planner error: {e}")

    if style_q and not style_enc.is_available():
        raise HTTPException(
            status_code=400,
            detail=(
                "Style axis requires a Wonjune checkpoint. Set "
                "WONJUNE_CHECKPOINT_PATH or restrict the query to a topical axis."
            ),
        )

    try:
        scores = score_query(corpus_id, style_q, topic_q, blend=blend, fusion=fusion)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {e}")

    return {
        "decomposition": {
            "style": style_q,
            "topic": topic_q,
            "rationale": rationale,
        },
        "scores": scores,
    }


@router.post("/corpora/{corpus_id}/similar")
async def corpus_similar(corpus_id: int, request: Request):
    body = await request.json()
    snippet_ids = body.get("snippet_ids") or []
    if not isinstance(snippet_ids, list) or not snippet_ids:
        raise HTTPException(status_code=400, detail="snippet_ids (non-empty list) is required")
    scores = score_signature(corpus_id, snippet_ids)
    return {"scores": scores}


@router.get("/snippets/{snippet_id}")
def get_snippet(snippet_id: int):
    with session() as s:
        snip = s.get(Snippet, snippet_id)
        if not snip:
            raise HTTPException(status_code=404, detail="Snippet not found")
        conv = s.get(Conversation, snip.conversation_id)
        # Surrounding context: ±3 snippets.
        neighbors = list(s.exec(
            select(Snippet).where(
                Snippet.conversation_id == snip.conversation_id,
                Snippet.idx >= max(0, snip.idx - 3),
                Snippet.idx <= snip.idx + 3,
            ).order_by(Snippet.idx)  # type: ignore[attr-defined]
        ).all())
        words = list(s.exec(
            select(Word).where(Word.snippet_id == snip.id).order_by(Word.idx)  # type: ignore[attr-defined]
        ).all())
        return {
            "snippet": {
                "id": snip.id,
                "idx": snip.idx,
                "start_sec": snip.start_sec,
                "end_sec": snip.end_sec,
                "speaker_name": snip.speaker_name,
                "text": snip.text,
                "words": [
                    {"start_sec": w.start_sec, "end_sec": w.end_sec, "text": w.text}
                    for w in words
                ],
            },
            "conversation": {
                "id": conv.id if conv else None,
                "title": conv.title if conv else "",
                "has_audio": bool(conv and conv.audio_path),
            },
            "neighbors": [
                {
                    "id": n.id,
                    "idx": n.idx,
                    "start_sec": n.start_sec,
                    "end_sec": n.end_sec,
                    "text": n.text,
                    "speaker_name": n.speaker_name,
                }
                for n in neighbors
            ],
        }


@router.post("/snippets/{snippet_id}/explain")
async def explain_route(snippet_id: int, request: Request):
    body = await request.json()
    style = body.get("style") or ""
    topic = body.get("topic") or ""
    style_score = float(body.get("style_score") or 0.0)
    topic_score = float(body.get("topic_score") or 0.0)
    try:
        text = explain_snippet(
            snippet_id,
            style=style,
            topic=topic,
            style_score=style_score,
            topic_score=topic_score,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Explanation error: {e}")
    return {"explanation": text}


@router.get("/conversations/{conversation_id}/audio")
def stream_audio(conversation_id: str, start: Optional[float] = Query(None), end: Optional[float] = Query(None)):
    """Stream the full audio file, or an in-memory slice when start/end are provided.

    `conversation_id` accepts either a numeric DB primary key (corpus-ingested
    audio) OR a transcript stem (JSON-only highlighter conversations whose
    audio lives in one of `AUDIO_DIRS`).
    """
    audio_path: Optional[str] = None
    with session() as s:
        try:
            db_id = int(conversation_id)
        except ValueError:
            db_id = None
        if db_id is not None:
            conv = s.get(Conversation, db_id)
            if conv and conv.audio_path:
                audio_path = conv.audio_path
        if audio_path is None:
            conv = s.exec(
                select(Conversation).where(Conversation.title == conversation_id)
            ).first()
            if conv and conv.audio_path:
                audio_path = conv.audio_path
    if audio_path is None:
        p = find_audio_for(conversation_id)
        if p is not None:
            audio_path = str(p)
    if audio_path is None:
        raise HTTPException(status_code=404, detail="Audio not available for this conversation")

    media_type = "audio/mpeg" if audio_path.lower().endswith(".mp3") else "audio/wav"

    if start is None and end is None:
        if not Path(audio_path).is_file():
            raise HTTPException(status_code=404, detail="Audio file missing on disk")
        return FileResponse(audio_path, media_type=media_type)

    # Slice in memory and return.
    import io
    import soundfile as sf
    from audio.prep import TARGET_SR, load_mono_16k, slice_samples
    samples = load_mono_16k(audio_path)
    sl = slice_samples(samples, float(start or 0.0), float(end or (len(samples) / TARGET_SR)))
    buf = io.BytesIO()
    sf.write(buf, sl, TARGET_SR, subtype="PCM_16", format="WAV")
    buf.seek(0)
    from fastapi.responses import Response
    return Response(content=buf.read(), media_type="audio/wav")
