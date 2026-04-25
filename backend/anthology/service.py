"""
Anthology CRUD and data loading helpers. Thin service layer on top of
the SQLModel rows defined in `db.py`.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Dict, List, Optional

from sqlmodel import select

from db import Anthology, Clip, Conversation, Section, Snippet, Word, session


def create_anthology(name: str, preface: str = "") -> int:
    with session() as s:
        a = Anthology(name=name, preface=preface)
        s.add(a)
        s.commit()
        s.refresh(a)
        # Create a default section so the anthology is ready to receive clips.
        default = Section(anthology_id=a.id, idx=0, title="", intro="")  # type: ignore[arg-type]
        s.add(default)
        s.commit()
        return a.id  # type: ignore[return-value]


def list_anthologies() -> List[Dict]:
    with session() as s:
        rows = s.exec(select(Anthology).order_by(Anthology.created_at.desc())).all()  # type: ignore[attr-defined]
        return [
            {
                "id": a.id,
                "name": a.name,
                "preface": a.preface,
                "created_at": a.created_at.isoformat(),
                "updated_at": a.updated_at.isoformat(),
            }
            for a in rows
        ]


def get_anthology(anth_id: int) -> Dict:
    with session() as s:
        a = s.get(Anthology, anth_id)
        if not a:
            raise FileNotFoundError(f"Anthology {anth_id} not found")
        sections = list(s.exec(
            select(Section).where(Section.anthology_id == anth_id).order_by(Section.idx)  # type: ignore[attr-defined]
        ).all())
        out_sections = []
        for sec in sections:
            clips = list(s.exec(
                select(Clip).where(Clip.section_id == sec.id).order_by(Clip.idx)  # type: ignore[attr-defined]
            ).all())
            out_clips = []
            for c in clips:
                conv = s.get(Conversation, c.conversation_id)
                out_clips.append({
                    "id": c.id,
                    "idx": c.idx,
                    "conversation_id": c.conversation_id,
                    "conversation_title": conv.title if conv else "",
                    "start_sec": c.start_sec,
                    "end_sec": c.end_sec,
                    "tags": json.loads(c.tags_json or "[]"),
                    "curator_note": c.curator_note,
                    "clip_text": c.clip_text or "",
                    "source": c.source,
                    "source_ref": c.source_ref,
                })
            out_sections.append({
                "id": sec.id,
                "idx": sec.idx,
                "title": sec.title,
                "intro": sec.intro,
                "clips": out_clips,
            })
        return {
            "id": a.id,
            "name": a.name,
            "preface": a.preface,
            "created_at": a.created_at.isoformat(),
            "updated_at": a.updated_at.isoformat(),
            "sections": out_sections,
        }


def update_anthology(anth_id: int, name: Optional[str] = None, preface: Optional[str] = None) -> None:
    with session() as s:
        a = s.get(Anthology, anth_id)
        if not a:
            raise FileNotFoundError(f"Anthology {anth_id} not found")
        if name is not None:
            a.name = name
        if preface is not None:
            a.preface = preface
        a.updated_at = datetime.utcnow()
        s.add(a)
        s.commit()


def upsert_section(anth_id: int, section_id: Optional[int], title: str, intro: str, idx: Optional[int] = None) -> int:
    with session() as s:
        if section_id:
            sec = s.get(Section, section_id)
            if not sec:
                raise FileNotFoundError(f"Section {section_id} not found")
            sec.title = title
            sec.intro = intro
            if idx is not None:
                sec.idx = idx
            s.add(sec)
            s.commit()
            return sec.id  # type: ignore[return-value]
        # Create with next idx.
        existing = s.exec(
            select(Section).where(Section.anthology_id == anth_id)  # type: ignore[attr-defined]
        ).all()
        next_idx = max((x.idx for x in existing), default=-1) + 1
        sec = Section(anthology_id=anth_id, idx=idx if idx is not None else next_idx, title=title, intro=intro)
        s.add(sec)
        s.commit()
        s.refresh(sec)
        return sec.id  # type: ignore[return-value]


def delete_section(section_id: int) -> None:
    with session() as s:
        clips = s.exec(select(Clip).where(Clip.section_id == section_id)).all()  # type: ignore[attr-defined]
        for c in clips:
            s.delete(c)
        sec = s.get(Section, section_id)
        if sec:
            s.delete(sec)
        s.commit()


def add_clip(
    section_id: int,
    conversation_id: int,
    start_sec: float,
    end_sec: float,
    tags: Optional[List[str]] = None,
    curator_note: str = "",
    clip_text: str = "",
    source: str = "manual",
    source_ref: Optional[str] = None,
) -> int:
    with session() as s:
        existing = s.exec(
            select(Clip).where(Clip.section_id == section_id)  # type: ignore[attr-defined]
        ).all()
        next_idx = max((c.idx for c in existing), default=-1) + 1
        c = Clip(
            section_id=section_id,
            idx=next_idx,
            conversation_id=conversation_id,
            start_sec=start_sec,
            end_sec=end_sec,
            tags_json=json.dumps(tags or []),
            curator_note=curator_note,
            clip_text=clip_text or "",
            source=source,
            source_ref=source_ref,
        )
        s.add(c)
        s.commit()
        s.refresh(c)
        return c.id  # type: ignore[return-value]


def update_clip(
    clip_id: int,
    start_sec: Optional[float] = None,
    end_sec: Optional[float] = None,
    tags: Optional[List[str]] = None,
    curator_note: Optional[str] = None,
    clip_text: Optional[str] = None,
    section_id: Optional[int] = None,
    idx: Optional[int] = None,
) -> None:
    with session() as s:
        c = s.get(Clip, clip_id)
        if not c:
            raise FileNotFoundError(f"Clip {clip_id} not found")
        if start_sec is not None:
            c.start_sec = start_sec
        if end_sec is not None:
            c.end_sec = end_sec
        if tags is not None:
            c.tags_json = json.dumps(tags)
        if curator_note is not None:
            c.curator_note = curator_note
        if clip_text is not None:
            c.clip_text = clip_text
        if section_id is not None:
            c.section_id = section_id
        if idx is not None:
            c.idx = idx
        s.add(c)
        s.commit()


def delete_clip(clip_id: int) -> None:
    with session() as s:
        c = s.get(Clip, clip_id)
        if c:
            s.delete(c)
        s.commit()


def reorder_clips(section_id: int, ordered_clip_ids: List[int]) -> None:
    with session() as s:
        for i, cid in enumerate(ordered_clip_ids):
            c = s.get(Clip, cid)
            if c and c.section_id == section_id:
                c.idx = i
                s.add(c)
        s.commit()


def reorder_sections(anth_id: int, ordered_section_ids: List[int]) -> None:
    with session() as s:
        for i, sid in enumerate(ordered_section_ids):
            sec = s.get(Section, sid)
            if sec and sec.anthology_id == anth_id:
                sec.idx = i
                s.add(sec)
        s.commit()


def clip_transcript(conversation_id: int, start_sec: float, end_sec: float) -> Dict:
    """Extract the per-word transcript strictly within the clip's span.

    Returns only the words whose midpoint falls inside [start_sec, end_sec].
    Snippet bodies are intentionally excluded — anthologies should never
    expose text outside the lifted span (the original corpus still has it).
    Speaker labels are attached to each word from the parent snippet for
    downstream display.
    """
    with session() as s:
        snippets = list(s.exec(
            select(Snippet).where(Snippet.conversation_id == conversation_id).order_by(Snippet.idx)  # type: ignore[attr-defined]
        ).all())
        out_words = []
        for snip in snippets:
            if snip.end_sec < start_sec or snip.start_sec > end_sec:
                continue
            words = list(s.exec(
                select(Word).where(Word.snippet_id == snip.id).order_by(Word.idx)  # type: ignore[attr-defined]
            ).all())
            for w in words:
                mid = (w.start_sec + w.end_sec) / 2.0
                if mid < start_sec or mid > end_sec:
                    continue
                out_words.append({
                    "start_sec": w.start_sec,
                    "end_sec": w.end_sec,
                    "text": w.text,
                    "speaker_id": snip.speaker_id,
                    "speaker_name": snip.speaker_name,
                })
        return {"words": out_words}
