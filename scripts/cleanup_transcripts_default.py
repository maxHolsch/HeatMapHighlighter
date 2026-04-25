"""
One-shot cleanup: remove the legacy `transcripts-default` corpus that the
old register-on-lift code created. Any existing anthology clips that point
at conversations under it are first re-pointed to the matching conversation
(by title) in another corpus, so no clip becomes a dangling reference.

Run from the repo root:
    backend/.venv/bin/python scripts/cleanup_transcripts_default.py [--dry-run]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlmodel import select  # noqa: E402

from db import Clip, Conversation, Corpus, Snippet, Word, session  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Print actions without committing")
    args = ap.parse_args()

    with session() as s:
        td = s.exec(select(Corpus).where(Corpus.name == "transcripts-default")).first()
        if not td:
            print("No 'transcripts-default' corpus — nothing to do.")
            return 0

        td_convs = list(s.exec(select(Conversation).where(Conversation.corpus_id == td.id)).all())
        print(f"Found 'transcripts-default' (id={td.id}) with {len(td_convs)} conversation(s).")

        # Build a map of title → list of replacement conversations (any corpus
        # other than transcripts-default).
        replacements: dict[str, Conversation] = {}
        for cv in td_convs:
            other = s.exec(
                select(Conversation).where(
                    Conversation.title == cv.title,
                    Conversation.corpus_id != td.id,
                )
            ).first()
            if other:
                replacements[cv.title] = other

        # Re-point clips for each duplicate-by-title conversation.
        unresolved: list[Conversation] = []
        repointed_total = 0
        for cv in td_convs:
            clips = list(s.exec(select(Clip).where(Clip.conversation_id == cv.id)).all())
            target = replacements.get(cv.title)
            if not clips:
                continue
            if target is None:
                unresolved.append(cv)
                print(
                    f"  ⚠ {len(clips)} clip(s) reference {cv.title!r} (id={cv.id}) "
                    f"but no replacement conversation exists in another corpus."
                )
                continue
            print(
                f"  → re-pointing {len(clips)} clip(s) from {cv.title!r} "
                f"(id={cv.id} → id={target.id} in corpus {target.corpus_id})"
            )
            for cl in clips:
                cl.conversation_id = target.id  # type: ignore[assignment]
                s.add(cl)
            repointed_total += len(clips)

        if unresolved:
            print(
                "\nAborting before deletion: some clips would become orphans. "
                "Re-ingest the matching transcript into another corpus first, "
                "or delete those clips from the anthology UI."
            )
            return 1

        # Delete words → snippets → conversations → corpus.
        for cv in td_convs:
            snips = list(s.exec(select(Snippet).where(Snippet.conversation_id == cv.id)).all())
            for sn in snips:
                words = list(s.exec(select(Word).where(Word.snippet_id == sn.id)).all())
                for w in words:
                    s.delete(w)
                s.delete(sn)
            s.delete(cv)
            print(f"  ✗ deleted conversation id={cv.id} ({cv.title!r}) + snippets + words")

        s.delete(td)
        print(f"  ✗ deleted corpus id={td.id} ('transcripts-default')")

        if args.dry_run:
            print("\nDry run — rolling back.")
            s.rollback()
        else:
            s.commit()
            print(f"\nDone. Re-pointed {repointed_total} clip(s); removed transcripts-default.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
