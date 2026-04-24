"""
AssemblyAI backend: upload audio, poll for a transcript, return AsrSegments.

We use the REST API directly (no SDK) so the only dep is `requests`.
AssemblyAI accepts MP3/M4A/WAV directly, so we upload the *original*
audio file (not the resampled WAV), which is both faster to upload
(smaller) and avoids any transcoding artifacts.

Returns segments shaped the same as the faster-whisper path: each
segment contains word-level timestamps.
"""

from __future__ import annotations

import os
import time
from typing import List, Optional

import requests

from .asr import AsrSegment, AsrWord


API_BASE = "https://api.assemblyai.com/v2"
POLL_INTERVAL_SEC = 3.0
MAX_POLL_SECONDS = 3600  # give up after an hour


def _key() -> str:
    k = os.environ.get("ASSEMBLYAI_API_KEY", "")
    if not k:
        raise RuntimeError(
            "ASSEMBLYAI_API_KEY is not set. Either set it or switch "
            "ASR_PROVIDER back to 'whisper'."
        )
    return k


def _upload(path: str) -> str:
    headers = {"authorization": _key()}
    with open(path, "rb") as f:
        resp = requests.post(
            f"{API_BASE}/upload",
            headers=headers,
            data=f,
            timeout=600,
        )
    resp.raise_for_status()
    return resp.json()["upload_url"]


def _submit(upload_url: str, language: Optional[str]) -> str:
    headers = {"authorization": _key(), "content-type": "application/json"}
    body = {
        "audio_url": upload_url,
        "speech_models": ["universal-3-pro"],
        "speaker_labels": True,
    }
    if language:
        body["language_code"] = language
    resp = requests.post(f"{API_BASE}/transcript", headers=headers, json=body, timeout=60)
    if resp.status_code >= 400:
        # Surface AssemblyAI's actual error message; their response body is
        # the only way to know which parameter they rejected.
        raise RuntimeError(
            f"AssemblyAI submit failed ({resp.status_code}): {resp.text}"
        )
    return resp.json()["id"]


def _poll(transcript_id: str) -> dict:
    headers = {"authorization": _key()}
    waited = 0.0
    while waited < MAX_POLL_SECONDS:
        resp = requests.get(f"{API_BASE}/transcript/{transcript_id}", headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        status = data.get("status")
        if status == "completed":
            return data
        if status == "error":
            raise RuntimeError(f"AssemblyAI transcription failed: {data.get('error')}")
        time.sleep(POLL_INTERVAL_SEC)
        waited += POLL_INTERVAL_SEC
    raise RuntimeError("AssemblyAI transcription timed out")


def transcribe(audio_path: str, language: Optional[str] = None) -> List[AsrSegment]:
    print(f"  [asr=assemblyai] uploading {os.path.basename(audio_path)}...", flush=True)
    upload_url = _upload(audio_path)
    print("  [asr=assemblyai] submitting transcription job...", flush=True)
    tid = _submit(upload_url, language)
    print(f"  [asr=assemblyai] polling transcript {tid}...", flush=True)
    data = _poll(tid)

    words = data.get("words") or []
    utterances = data.get("utterances") or []

    def _ms(v):
        return float(v) / 1000.0 if v is not None else 0.0

    def _mk_word(w) -> AsrWord:
        return AsrWord(
            start=_ms(w.get("start")),
            end=_ms(w.get("end")),
            text=(w.get("text") or "").strip(),
        )

    # Prefer speaker-bounded utterances as segments; fall back to one big
    # segment of all words (segment.py splits on sentence boundaries + 15s cap).
    if utterances:
        out: List[AsrSegment] = []
        for u in utterances:
            u_words = [_mk_word(w) for w in (u.get("words") or [])]
            if not u_words:
                continue
            out.append(AsrSegment(
                start=_ms(u.get("start")),
                end=_ms(u.get("end")),
                text=(u.get("text") or "").strip(),
                words=u_words,
            ))
        return out

    all_words = [_mk_word(w) for w in words]
    if not all_words:
        return []
    return [AsrSegment(
        start=all_words[0].start,
        end=all_words[-1].end,
        text=data.get("text", ""),
        words=all_words,
    )]
