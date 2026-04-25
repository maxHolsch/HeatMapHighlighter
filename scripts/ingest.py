#!/usr/bin/env python3
"""
Ingest audio / transcript JSON into a corpus.

Examples:
    # Audio folder:
    python scripts/ingest.py --corpus "my corpus" --audio-dir /path/to/wavs/

    # Transcript JSON folder (text-only):
    python scripts/ingest.py --corpus "bos" --transcripts-dir ./transcripts_json/

    # Transcripts + matching WAV folder (paired by stem):
    python scripts/ingest.py --corpus "bos" \\
        --transcripts-dir ./transcripts_json/ --audio-dir /path/to/wavs/
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Make `backend/` importable whether run from repo root or backend/.
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "backend"))

from audio.pipeline import (  # noqa: E402
    ensure_corpus,
    ingest_audio_file,
    ingest_transcript_only,
    ingest_transcript_with_audio,
)

AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", required=True, help="Corpus name (created if missing).")
    ap.add_argument("--audio-dir", help="Directory of audio files.")
    ap.add_argument("--transcripts-dir", help="Directory of transcript JSON files.")
    ap.add_argument("--language", default=None, help="ASR language (e.g. 'en').")
    args = ap.parse_args()

    if not args.audio_dir and not args.transcripts_dir:
        ap.error("Provide --audio-dir and/or --transcripts-dir")

    corpus_id = ensure_corpus(args.corpus)
    print(f"Corpus '{args.corpus}' -> id {corpus_id}")

    # Index audio files by stem for optional pairing.
    audio_by_stem = {}
    if args.audio_dir:
        for p in sorted(Path(args.audio_dir).iterdir()):
            if p.suffix.lower() in AUDIO_EXTS:
                audio_by_stem[p.stem] = p

    if args.transcripts_dir:
        for p in sorted(Path(args.transcripts_dir).glob("*.json")):
            stem = p.stem
            if stem in audio_by_stem:
                print(f"  ingesting {stem} (transcript + audio)")
                cid = ingest_transcript_with_audio(
                    corpus_id, stem, str(p), str(audio_by_stem.pop(stem))
                )
            else:
                print(f"  ingesting {stem} (transcript only)")
                cid = ingest_transcript_only(corpus_id, stem, str(p))
            print(f"    -> conversation id {cid}")

    # Any remaining audio files (no matching transcript JSON): ingest as audio-only.
    for stem, p in audio_by_stem.items():
        print(f"  ingesting {stem} (audio only)")
        cid = ingest_audio_file(corpus_id, stem, str(p), language=args.language)
        print(f"    -> conversation id {cid}")

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
