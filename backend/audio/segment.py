"""
Shape Whisper segments into snippets targeting 3-15 seconds, carrying
word-level timestamps through for karaoke export and later audio cuts.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from .asr import AsrSegment, AsrWord

MIN_SEC = 3.0
MAX_SEC = 15.0


@dataclass
class SnippetOut:
    start: float
    end: float
    text: str
    words: List[AsrWord]


def snippets_from_segments(segments: List[AsrSegment]) -> List[SnippetOut]:
    """
    Merge short Whisper segments (<MIN_SEC) with their neighbors and split
    long ones (>MAX_SEC) on sentence boundaries (word-level).
    """
    # Step 1: merge short-consecutive segments.
    merged: List[SnippetOut] = []
    buf_words: List[AsrWord] = []
    buf_start: float = 0.0

    def flush():
        if not buf_words:
            return
        text = " ".join(w.text for w in buf_words).strip()
        merged.append(SnippetOut(
            start=buf_words[0].start,
            end=buf_words[-1].end,
            text=text,
            words=list(buf_words),
        ))

    for seg in segments:
        if not seg.words:
            # Synthesize a single pseudo-word.
            words = [AsrWord(start=seg.start, end=seg.end, text=seg.text)]
        else:
            words = seg.words
        if not buf_words:
            buf_start = words[0].start
            buf_words = list(words)
            continue
        span = buf_words[-1].end - buf_start
        if span < MIN_SEC:
            buf_words.extend(words)
        else:
            flush()
            buf_start = words[0].start
            buf_words = list(words)
    flush()

    # Step 2: split long snippets at sentence endings (., ?, !).
    out: List[SnippetOut] = []
    for snip in merged:
        if snip.end - snip.start <= MAX_SEC:
            out.append(snip)
            continue
        current: List[AsrWord] = []
        for w in snip.words:
            current.append(w)
            span = current[-1].end - current[0].start
            ends_sentence = w.text.endswith((".", "?", "!"))
            if span >= MIN_SEC and (ends_sentence or span >= MAX_SEC):
                text = " ".join(x.text for x in current).strip()
                out.append(SnippetOut(
                    start=current[0].start,
                    end=current[-1].end,
                    text=text,
                    words=current,
                ))
                current = []
        if current:
            text = " ".join(x.text for x in current).strip()
            out.append(SnippetOut(
                start=current[0].start,
                end=current[-1].end,
                text=text,
                words=current,
            ))
    return out
