"""
AssemblyAI ASR backend using the official Python SDK.

The SDK auto-handles file upload + polling, so the previous raw-REST
implementation has been replaced by a thin wrapper. Output shape matches
the faster-whisper path: a list of `AsrSegment`s with word-level
timestamps. With `speaker_labels=True`, each segment carries the
speaker label from AssemblyAI's diarization (one segment per utterance).

Diarization quality is improved by `speaker_options` — see
https://www.assemblyai.com/docs/pre-recorded-audio/label-speakers.
The bounds default to 2..6 (typical podcast range) and can be overridden
via `ASSEMBLYAI_MIN_SPEAKERS` / `ASSEMBLYAI_MAX_SPEAKERS` env vars.
"""

from __future__ import annotations

import os
from typing import List, Optional

from .asr import AsrSegment, AsrWord


def _ms(v) -> float:
    return float(v) / 1000.0 if v is not None else 0.0


def _key() -> str:
    k = os.environ.get("ASSEMBLYAI_API_KEY", "")
    if not k:
        raise RuntimeError(
            "ASSEMBLYAI_API_KEY is not set. Either set it or switch "
            "ASR_PROVIDER back to 'whisper'."
        )
    return k


def _speaker_bounds() -> tuple[int, int]:
    return (
        int(os.environ.get("ASSEMBLYAI_MIN_SPEAKERS", "2")),
        int(os.environ.get("ASSEMBLYAI_MAX_SPEAKERS", "6")),
    )


def transcribe(audio_path: str, language: Optional[str] = None) -> List[AsrSegment]:
    import assemblyai as aai

    aai.settings.api_key = _key()

    min_sp, max_sp = _speaker_bounds()
    config_kwargs = dict(
        speech_model=aai.SpeechModel.universal,
        speaker_labels=True,
        speaker_options=aai.SpeakerOptions(
            min_speakers_expected=min_sp,
            max_speakers_expected=max_sp,
        ),
    )
    if language:
        config_kwargs["language_code"] = language

    config = aai.TranscriptionConfig(**config_kwargs)

    print(f"  [asr=assemblyai] transcribing {os.path.basename(audio_path)}…", flush=True)
    transcript = aai.Transcriber(config=config).transcribe(audio_path)

    if transcript.status == aai.TranscriptStatus.error:
        raise RuntimeError(f"AssemblyAI transcription failed: {transcript.error}")

    out: List[AsrSegment] = []
    utterances = transcript.utterances or []
    if utterances:
        for u in utterances:
            words = [
                AsrWord(start=_ms(w.start), end=_ms(w.end), text=(w.text or "").strip())
                for w in (u.words or [])
            ]
            if not words:
                continue
            out.append(AsrSegment(
                start=_ms(u.start),
                end=_ms(u.end),
                text=(u.text or "").strip(),
                words=words,
                speaker=u.speaker,
            ))
        return out

    # Fallback: no utterances returned (rare). Emit one big segment of all words.
    all_words = [
        AsrWord(start=_ms(w.start), end=_ms(w.end), text=(w.text or "").strip())
        for w in (transcript.words or [])
    ]
    if not all_words:
        return []
    return [AsrSegment(
        start=all_words[0].start,
        end=all_words[-1].end,
        text=transcript.text or "",
        words=all_words,
        speaker=None,
    )]
