#!/usr/bin/env python3
"""
Verify that every transcript JSON has speaker-turn snippets:

- adjacent snippets must NOT share a speaker_id
- every snippet must carry a non-null speaker_id (diarization succeeded)
- snippet boundaries must be monotonic in time

Exits 0 on success, 1 on first failure. Loads the same JSONs the highlighter
serves, plus runs an end-to-end check via `load_conversation` so any
in-process / cleaning logic that reshapes the snippets is also exercised.

Usage:
    python scripts/test_speaker_turns.py
    python scripts/test_speaker_turns.py 02_Will-the-AI-Bubble-Burst
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "backend"))

from config import TRANSCRIPTS_DIR  # noqa: E402
from transcript_processor import load_conversation  # noqa: E402


FAIL = "\033[31m✗\033[0m"
PASS = "\033[32m✓\033[0m"


def assert_speaker_turns(label: str, snippets: list[dict]) -> list[str]:
    errors: list[str] = []
    if not snippets:
        errors.append(f"{label}: empty snippet list")
        return errors

    null_count = sum(1 for s in snippets if not s.get("speaker_id"))
    if null_count:
        errors.append(
            f"{label}: {null_count}/{len(snippets)} snippets have no speaker_id "
            "(diarization didn't run, or this came from a non-diarized source)"
        )

    adj_same: list[int] = []
    for i in range(1, len(snippets)):
        a = snippets[i - 1].get("speaker_id")
        b = snippets[i].get("speaker_id")
        if a is not None and b is not None and a == b:
            adj_same.append(i)
    if adj_same:
        sample = adj_same[:5]
        errors.append(
            f"{label}: {len(adj_same)} adjacent snippet pairs share speaker; "
            f"first offending indices: {sample}"
        )

    nonmono: list[int] = []
    for i in range(1, len(snippets)):
        prev_end = float(snippets[i - 1].get("audio_end_offset") or 0.0)
        cur_start = float(snippets[i].get("audio_start_offset") or 0.0)
        if cur_start + 0.5 < prev_end:  # 500ms slack for ASR overlap
            nonmono.append(i)
    if nonmono:
        errors.append(
            f"{label}: {len(nonmono)} non-monotonic boundaries; "
            f"first: {nonmono[:5]}"
        )

    return errors


def main(argv: list[str]) -> int:
    if argv:
        stems = argv
    else:
        stems = [p.stem for p in sorted(TRANSCRIPTS_DIR.glob("*.json"))]

    if not stems:
        print(f"No transcript JSONs in {TRANSCRIPTS_DIR}.")
        return 1

    any_fail = False
    for stem in stems:
        path = TRANSCRIPTS_DIR / f"{stem}.json"
        print(f"\n--- {stem} ---")
        if not path.exists():
            print(f"{FAIL} {path} missing")
            any_fail = True
            continue

        # Disk-level check.
        with path.open() as f:
            raw = json.load(f)
        disk_errors = assert_speaker_turns(f"{stem} [disk]", raw.get("snippets") or [])

        # End-to-end check via the loader the highlighter actually calls.
        loaded = load_conversation(stem)
        load_errors = assert_speaker_turns(f"{stem} [loaded]", loaded.get("original_snippets") or [])

        for e in disk_errors + load_errors:
            print(f"{FAIL} {e}")
            any_fail = True
        if not disk_errors and not load_errors:
            n = len(raw.get("snippets") or [])
            speakers = sorted({s.get("speaker_id") for s in raw.get("snippets") or []})
            print(f"{PASS} {n} snippets · speakers={speakers} · adjacent_same=0 · monotonic")

    print()
    if any_fail:
        print(f"{FAIL} one or more transcripts failed speaker-turn invariants")
        return 1
    print(f"{PASS} all transcripts pass speaker-turn invariants")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
