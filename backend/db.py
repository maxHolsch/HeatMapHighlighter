"""
SQLModel schema + session helpers for corpus, audio, vectors, and anthology state.

The existing highlighter pipeline (transcript_processor.py) operates on raw
Cortico JSON files on disk and does not use this DB at all. Everything new
(audio ingestion, style/topic embeddings, cross-conversation queries,
anthologies, clip state) lives here.

Per-corpus snippet style and topic embeddings are stored as numpy files
(`data/vectors/<corpus_id>/{style,topic}.npy`), with DB rows pointing at
the row index.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Iterator, Optional

from sqlalchemy import Engine
from sqlmodel import Field, SQLModel, Session, create_engine

from config import DB_PATH, ensure_data_dirs


class Corpus(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    source_root: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Conversation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    corpus_id: int = Field(foreign_key="corpus.id", index=True)
    # Human-readable title (often the Cortico conversation-<id>).
    title: str
    # Cortico conversation identifier if this conversation was imported from JSON.
    cortico_id: Optional[str] = Field(default=None, index=True)
    # Path on disk of the original transcript JSON (Cortico) if any.
    transcript_path: Optional[str] = None
    # Path on disk of the prepared 16kHz mono WAV if any.
    audio_path: Optional[str] = None
    duration_sec: Optional[float] = None
    num_snippets: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Snippet(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: int = Field(foreign_key="conversation.id", index=True)
    # Index within the conversation's ordered snippet list (matches
    # TranscriptProcessor.original_snippets index when Cortico-imported).
    idx: int
    start_sec: float
    end_sec: float
    speaker_id: Optional[str] = None
    speaker_name: Optional[str] = None
    text: str
    # Row index into the per-corpus style.npy / topic.npy matrices.
    style_row: Optional[int] = Field(default=None, index=True)
    topic_row: Optional[int] = Field(default=None, index=True)


class Word(SQLModel, table=True):
    """Word-level ASR output for karaoke display."""
    id: Optional[int] = Field(default=None, primary_key=True)
    snippet_id: int = Field(foreign_key="snippet.id", index=True)
    idx: int
    start_sec: float
    end_sec: float
    text: str


class Anthology(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    preface: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Section(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    anthology_id: int = Field(foreign_key="anthology.id", index=True)
    idx: int
    title: str = ""
    intro: str = ""


class Clip(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    section_id: int = Field(foreign_key="section.id", index=True)
    idx: int
    conversation_id: int = Field(foreign_key="conversation.id")
    start_sec: float
    end_sec: float
    # JSON-encoded list of free-form tags.
    tags_json: str = "[]"
    curator_note: str = ""
    # "manual" | "pass2_span" | "query_match"
    source: str = "manual"
    source_ref: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Explanation(SQLModel, table=True):
    """Cached 'why salient' text for a snippet under a specific query hash."""
    id: Optional[int] = Field(default=None, primary_key=True)
    snippet_id: int = Field(foreign_key="snippet.id", index=True)
    query_hash: str = Field(index=True)
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


_engine: Optional[Engine] = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        ensure_data_dirs()
        Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(
            f"sqlite:///{DB_PATH}",
            echo=False,
            connect_args={"check_same_thread": False},
        )
        SQLModel.metadata.create_all(_engine)
    return _engine


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session


def session() -> Session:
    """Direct (non-dependency) session handle. Caller must close."""
    return Session(get_engine())
