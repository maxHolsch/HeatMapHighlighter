"""
Shape ASR segments into snippets.

Two modes:

- **Speaker-bounded passthrough**: when every segment carries a `speaker`
  label (i.e. diarized output from AssemblyAI utterances), each segment
  becomes one snippet 1:1. Speaker turns are the natural unit, so we
  preserve them rather than re-chunking.

- **Time-bounded re-chunk**: when speakers are absent (faster-whisper),
  merge short consecutive segments and split long ones at sentence
  boundaries to target 3–15 seconds per snippet.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from .asr import AsrSegment, AsrWord

MIN_SEC = 3.0
MAX_SEC = 15.0


@dataclass
class SnippetOut:
    start: float
    end: float
    text: str
    words: List[AsrWord]
    speaker: Optional[str] = None


def snippets_from_segments(segments: List[AsrSegment]) -> List[SnippetOut]:
    if not segments:
        return []

    if all(s.speaker for s in segments):
        # AssemblyAI splits a single speaker turn into multiple utterances when
        # there's a long silence inside the turn. Collapse consecutive
        # same-speaker utterances back into one snippet so each snippet is a
        # true speaker turn.
        out: List[SnippetOut] = []
        for seg in segments:
            if not (seg.words or seg.text):
                continue
            if out and out[-1].speaker == seg.speaker:
                prev = out[-1]
                joined = (prev.text + " " + seg.text).strip() if prev.text and seg.text else (prev.text or seg.text)
                out[-1] = SnippetOut(
                    start=prev.start,
                    end=seg.end,
                    text=joined,
                    words=list(prev.words) + list(seg.words),
                    speaker=prev.speaker,
                )
            else:
                out.append(SnippetOut(
                    start=seg.start,
                    end=seg.end,
                    text=seg.text,
                    words=list(seg.words),
                    speaker=seg.speaker,
                ))
        return out

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
