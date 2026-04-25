#!/usr/bin/env python3
"""
Transcribe an audio folder into the JSON schema the highlighter loads from.

One JSON per audio file, written to `transcripts_json/<stem>.json`. Each file
has the shape::

    {
      "snippets": [
        {
          "audio_start_offset": float,
          "audio_end_offset": float,
          "speaker_id": "A" | "B" | ... | null,
          "speaker_name": "Speaker A" | ... | null,
          "words": [{"audio_start_offset": float, "audio_end_offset": float, "word": str}, ...]
        },
        ...
      ]
    }

Speaker grouping comes from the ASR provider's diarization. With AssemblyAI
(`ASR_PROVIDER=assemblyai`) each output snippet is one speaker turn; with
faster-whisper there's no diarization so every snippet's speaker fields are
null and snippets are 3–15s ASR chunks.

Examples:
    python scripts/transcribe_to_json.py --audio-dir ../iq2_audio
    python scripts/transcribe_to_json.py --audio-dir ./episodes --out-dir ./transcripts_json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Make `backend/` importable whether run from repo root or backend/.
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "backend"))

from audio.asr import transcribe  # noqa: E402
from audio.segment import snippets_from_segments  # noqa: E402
from config import TRANSCRIPTS_DIR  # noqa: E402

AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac"}


def transcribe_one(audio_path: Path, out_path: Path, language: str | None) -> None:
    segs = transcribe(str(audio_path), language=language)
    snippets = snippets_from_segments(segs)
    payload = {
        "snippets": [
            {
                "audio_start_offset": s.start,
                "audio_end_offset": s.end,
                "speaker_id": s.speaker,
                "speaker_name": f"Speaker {s.speaker}" if s.speaker else None,
                "words": [
                    {
                        "audio_start_offset": w.start,
                        "audio_end_offset": w.end,
                        "word": w.text,
                    }
                    for w in s.words
                ],
            }
            for s in snippets
        ],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio-dir", required=True, help="Directory of audio files to transcribe.")
    ap.add_argument("--out-dir", default=str(TRANSCRIPTS_DIR),
                    help=f"Output directory for transcript JSONs (default: {TRANSCRIPTS_DIR}).")
    ap.add_argument("--language", default=None, help="ASR language code (e.g. 'en').")
    ap.add_argument("--overwrite", action="store_true",
                    help="Re-transcribe even if the output JSON already exists.")
    args = ap.parse_args()

    audio_dir = Path(args.audio_dir)
    if not audio_dir.is_dir():
        ap.error(f"--audio-dir not a directory: {audio_dir}")
    out_dir = Path(args.out_dir)

    files = [p for p in sorted(audio_dir.iterdir()) if p.suffix.lower() in AUDIO_EXTS]
    if not files:
        print(f"No audio files in {audio_dir}.")
        return 0

    print(f"Transcribing {len(files)} files → {out_dir}")
    for p in files:
        out_path = out_dir / f"{p.stem}.json"
        if out_path.exists() and not args.overwrite:
            print(f"  skip (exists): {out_path.name}")
            continue
        print(f"  {p.name}")
        try:
            transcribe_one(p, out_path, args.language)
            print(f"    -> {out_path.name}")
        except Exception as e:
            print(f"    FAILED: {e}", file=sys.stderr)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
