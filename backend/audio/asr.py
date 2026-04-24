"""
faster-whisper wrapper: produce {segments, words} with word-level timestamps.

Segments are merged / split into snippets downstream in `segment.py`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from config import WHISPER_COMPUTE_TYPE, WHISPER_DEVICE, WHISPER_MODEL

_whisper = None


def _get_model():
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel  # local: heavy
        _whisper = WhisperModel(
            WHISPER_MODEL,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
        )
    return _whisper


@dataclass
class AsrWord:
    start: float
    end: float
    text: str


@dataclass
class AsrSegment:
    start: float
    end: float
    text: str
    words: List[AsrWord]


def transcribe(audio_path: str, language: Optional[str] = None) -> List[AsrSegment]:
    """Transcribe a WAV file. Returns segments with word-level timestamps.

    Routes to AssemblyAI when ASR_PROVIDER=assemblyai (and ASSEMBLYAI_API_KEY
    is set); falls back to faster-whisper otherwise.
    """
    import os
    provider = os.environ.get("ASR_PROVIDER", "").lower() or "whisper"
    if provider == "assemblyai":
        from .asr_assemblyai import transcribe as aai_transcribe
        return aai_transcribe(audio_path, language=language)

    model = _get_model()
    segs, _info = model.transcribe(
        audio_path,
        language=language,
        word_timestamps=True,
        vad_filter=True,
    )
    out: List[AsrSegment] = []
    for s in segs:
        words = []
        if s.words:
            for w in s.words:
                words.append(AsrWord(
                    start=float(w.start or 0.0),
                    end=float(w.end or 0.0),
                    text=(w.word or "").strip(),
                ))
        out.append(AsrSegment(
            start=float(s.start),
            end=float(s.end),
            text=(s.text or "").strip(),
            words=words,
        ))
    return out
