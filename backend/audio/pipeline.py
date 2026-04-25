"""
Ingestion pipeline.

Three entry points, all idempotent keyed on the conversation `title` within
a corpus:

- `ingest_audio_file(corpus_id, title, audio_src)`
    ASR → snippets → embeddings. Used for raw audio-only conversations.

- `ingest_transcript_with_audio(corpus_id, title, transcript_path, audio_src)`
    Uses existing transcript snippets for TEXT, slices audio by the
    transcript's per-snippet timestamps, and encodes style per slice. Runs
    topic encoder on the text.

- `ingest_transcript_only(corpus_id, title, transcript_path)`
    Text-only: topic embeddings only, no style. Still visible in the corpus
    heatmap (style axis is greyed out for text-only rows).

All three write to the SQLite DB and append to per-corpus vector .npy files
(creating them on first write). They can be re-run safely; existing
snippets for the conversation are replaced.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from sqlmodel import Session, select

from config import AUDIO_DIR, STYLE_EMBED_DIM, TOPIC_EMBED_DIM, VECTORS_DIR
from db import Conversation, Corpus, Snippet, Word, get_engine
from . import prep

# ---------------------------------------------------------------------------
# Vector matrix helpers
# ---------------------------------------------------------------------------

def _matrix_path(corpus_id: int, kind: str) -> Path:
    return VECTORS_DIR / str(corpus_id) / f"{kind}.npy"


def _load_matrix(corpus_id: int, kind: str, dim: int) -> np.ndarray:
    path = _matrix_path(corpus_id, kind)
    if path.is_file():
        m = np.load(path)
        if m.ndim != 2 or m.shape[1] != dim:
            raise RuntimeError(
                f"Corrupt matrix at {path}: expected (?, {dim}), got {m.shape}"
            )
        return m
    return np.zeros((0, dim), dtype=np.float32)


def _save_matrix(corpus_id: int, kind: str, matrix: np.ndarray) -> None:
    path = _matrix_path(corpus_id, kind)
    path.parent.mkdir(parents=True, exist_ok=True)
    np.save(path, matrix.astype(np.float32))


def _append_rows(corpus_id: int, kind: str, rows: np.ndarray, dim: int) -> Tuple[int, int]:
    """Append rows, return (start_row_index, end_row_index_exclusive)."""
    # CAVEAT (2026-04-25): re-ingesting a conversation appends new rows but
    # never reclaims the rows the old version pointed at. After a few
    # re-ingests the matrix accumulates orphan zero rows. They're harmless
    # for cosine search (they tie at score 0 and rank below real hits) but
    # waste disk + RAM. Future fix: track a free-list, or rewrite the matrix
    # from scratch by walking `Snippet` rows in DB order whenever
    # `_delete_existing_conversation` runs.
    existing = _load_matrix(corpus_id, kind, dim)
    start = existing.shape[0]
    if rows.shape[0] == 0:
        return start, start
    combined = np.concatenate([existing, rows.astype(np.float32)], axis=0)
    _save_matrix(corpus_id, kind, combined)
    return start, combined.shape[0]


# ---------------------------------------------------------------------------
# Corpus / conversation helpers
# ---------------------------------------------------------------------------

def ensure_corpus(name: str, source_root: str = "") -> int:
    from db import session
    with session() as s:
        existing = s.exec(select(Corpus).where(Corpus.name == name)).first()
        if existing:
            return existing.id  # type: ignore[return-value]
        c = Corpus(name=name, source_root=source_root)
        s.add(c)
        s.commit()
        s.refresh(c)
        return c.id  # type: ignore[return-value]


def _delete_existing_conversation(s: Session, corpus_id: int, title: str) -> None:
    existing = s.exec(
        select(Conversation).where(
            Conversation.corpus_id == corpus_id,
            Conversation.title == title,
        )
    ).first()
    if not existing:
        return
    # Delete words, snippets, then conversation.
    snippets = s.exec(select(Snippet).where(Snippet.conversation_id == existing.id)).all()
    for snip in snippets:
        words = s.exec(select(Word).where(Word.snippet_id == snip.id)).all()
        for w in words:
            s.delete(w)
        s.delete(snip)
    s.delete(existing)
    s.commit()


# ---------------------------------------------------------------------------
# Audio-only ingestion
# ---------------------------------------------------------------------------

def ingest_audio_file(
    corpus_id: int,
    title: str,
    audio_src: str,
    language: Optional[str] = None,
) -> int:
    """ASR an audio file, create Conversation + Snippets + Words, embed."""
    from .asr import transcribe
    from .segment import snippets_from_segments
    from encoders import topic as topic_enc
    from encoders import style as style_enc

    import os
    samples = prep.load_mono_16k(audio_src)
    wav_dest = AUDIO_DIR / f"corpus_{corpus_id}" / f"{title}.wav"
    prep.write_wav_16k(samples, wav_dest)

    # AssemblyAI accepts original MP3/M4A directly -- avoids a big WAV upload.
    # faster-whisper wants local WAV.
    asr_input = audio_src if os.environ.get("ASR_PROVIDER", "").lower() == "assemblyai" else str(wav_dest)
    segs = transcribe(asr_input, language=language)
    snippets = snippets_from_segments(segs)

    texts = [s.text for s in snippets]
    topic_vecs = topic_enc.embed(texts)

    if style_enc.is_available():
        slices = [prep.slice_samples(samples, s.start, s.end) for s in snippets]
        style_vecs = style_enc.embed_audio(slices)
    else:
        style_vecs = np.zeros((len(snippets), STYLE_EMBED_DIM), dtype=np.float32)

    return _persist(
        corpus_id=corpus_id,
        title=title,
        transcript_id=None,
        transcript_path=None,
        audio_path=str(wav_dest),
        duration_sec=prep.duration_sec(samples),
        snippets_data=[{
            "idx": i,
            "start_sec": s.start,
            "end_sec": s.end,
            "text": s.text,
            "speaker_id": s.speaker,
            "speaker_name": f"Speaker {s.speaker}" if s.speaker else None,
            "words": [{"idx": j, "start": w.start, "end": w.end, "text": w.text}
                      for j, w in enumerate(s.words)],
        } for i, s in enumerate(snippets)],
        style_vecs=style_vecs,
        topic_vecs=topic_vecs,
    )


# ---------------------------------------------------------------------------
# Pre-existing transcript JSON + audio pairing
# ---------------------------------------------------------------------------

def _load_transcript_json(transcript_path: str) -> Tuple[str, List[Dict]]:
    with open(transcript_path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    transcript_id = Path(transcript_path).stem
    snippets = []
    for i, s in enumerate(raw.get("snippets", [])):
        text = " ".join(w["word"] for w in s.get("words", [])).strip()
        snippets.append({
            "idx": i,
            "start_sec": float(s.get("audio_start_offset") or 0.0),
            "end_sec": float(s.get("audio_end_offset") or 0.0),
            "text": text,
            "speaker_id": s.get("speaker_id"),
            "speaker_name": s.get("speaker_name"),
            "words": [
                {
                    "idx": j,
                    "start": float(w.get("audio_start_offset") or 0.0),
                    "end": float(w.get("audio_end_offset") or 0.0),
                    "text": w.get("word", ""),
                }
                for j, w in enumerate(s.get("words", []))
            ],
        })
    return transcript_id, snippets


def ingest_transcript_only(
    corpus_id: int,
    title: str,
    transcript_path: str,
) -> int:
    """Text-only ingestion: topic embeddings, no style."""
    from encoders import topic as topic_enc
    transcript_id, snippets_data = _load_transcript_json(transcript_path)
    texts = [s["text"] for s in snippets_data]
    topic_vecs = topic_enc.embed(texts)
    style_vecs = np.zeros((len(snippets_data), STYLE_EMBED_DIM), dtype=np.float32)
    return _persist(
        corpus_id=corpus_id,
        title=title,
        transcript_id=transcript_id,
        transcript_path=transcript_path,
        audio_path=None,
        duration_sec=snippets_data[-1]["end_sec"] if snippets_data else 0.0,
        snippets_data=snippets_data,
        style_vecs=style_vecs,
        topic_vecs=topic_vecs,
    )


def ingest_transcript_with_audio(
    corpus_id: int,
    title: str,
    transcript_path: str,
    audio_src: str,
) -> int:
    """Pre-existing transcript snippets for text, paired audio for style."""
    from encoders import topic as topic_enc
    from encoders import style as style_enc

    samples = prep.load_mono_16k(audio_src)
    wav_dest = AUDIO_DIR / f"corpus_{corpus_id}" / f"{title}.wav"
    prep.write_wav_16k(samples, wav_dest)

    transcript_id, snippets_data = _load_transcript_json(transcript_path)
    texts = [s["text"] for s in snippets_data]
    topic_vecs = topic_enc.embed(texts)

    if style_enc.is_available():
        slices = [
            prep.slice_samples(samples, s["start_sec"], s["end_sec"])
            for s in snippets_data
        ]
        style_vecs = style_enc.embed_audio(slices)
    else:
        style_vecs = np.zeros((len(snippets_data), STYLE_EMBED_DIM), dtype=np.float32)

    return _persist(
        corpus_id=corpus_id,
        title=title,
        transcript_id=transcript_id,
        transcript_path=transcript_path,
        audio_path=str(wav_dest),
        duration_sec=prep.duration_sec(samples),
        snippets_data=snippets_data,
        style_vecs=style_vecs,
        topic_vecs=topic_vecs,
    )


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def _persist(
    *,
    corpus_id: int,
    title: str,
    transcript_id: Optional[str],
    transcript_path: Optional[str],
    audio_path: Optional[str],
    duration_sec: float,
    snippets_data: List[Dict],
    style_vecs: np.ndarray,
    topic_vecs: np.ndarray,
) -> int:
    """Create Conversation + Snippet + Word rows, append vector matrices."""
    from db import session

    n = len(snippets_data)
    if style_vecs.shape != (n, STYLE_EMBED_DIM):
        raise RuntimeError(f"style_vecs shape {style_vecs.shape} != ({n}, {STYLE_EMBED_DIM})")
    if topic_vecs.shape != (n, TOPIC_EMBED_DIM):
        raise RuntimeError(f"topic_vecs shape {topic_vecs.shape} != ({n}, {TOPIC_EMBED_DIM})")

    style_start, style_end = _append_rows(corpus_id, "style", style_vecs, STYLE_EMBED_DIM)
    topic_start, topic_end = _append_rows(corpus_id, "topic", topic_vecs, TOPIC_EMBED_DIM)

    with session() as s:
        _delete_existing_conversation(s, corpus_id, title)
        conv = Conversation(
            corpus_id=corpus_id,
            title=title,
            transcript_id=transcript_id,
            transcript_path=transcript_path,
            audio_path=audio_path,
            duration_sec=duration_sec,
            num_snippets=n,
        )
        s.add(conv)
        s.commit()
        s.refresh(conv)

        for i, sd in enumerate(snippets_data):
            snip = Snippet(
                conversation_id=conv.id,  # type: ignore[arg-type]
                idx=sd["idx"],
                start_sec=sd["start_sec"],
                end_sec=sd["end_sec"],
                speaker_id=sd.get("speaker_id"),
                speaker_name=sd.get("speaker_name"),
                text=sd["text"],
                style_row=style_start + i,
                topic_row=topic_start + i,
            )
            s.add(snip)
            s.commit()
            s.refresh(snip)
            for w in sd.get("words", []):
                s.add(Word(
                    snippet_id=snip.id,  # type: ignore[arg-type]
                    idx=w["idx"],
                    start_sec=w["start"],
                    end_sec=w["end"],
                    text=w["text"],
                ))
            s.commit()
        return conv.id  # type: ignore[return-value]
