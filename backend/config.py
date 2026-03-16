import os
from pathlib import Path

BASE_DIR = Path("/home/wjkang/projects/highlight_extraction")

RAW_TRANSCRIPTS_DIR = (
    BASE_DIR / "data" / "cortico" / "realtalk_boston" / "api_orig_transcripts_json"
)

PREDICTIONS_CACHE_DIR = (
    BASE_DIR / "llm-auto-highlighter" / "highlight_predictions_cache"
)

SAVED_HIGHLIGHTS_DIR = (
    BASE_DIR / "llm-auto-highlighter" / "saved_highlights"
)

OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5-2025-08-07")

with open(
    BASE_DIR / "llm-auto-highlighter" / "backend" / "base_prompt.md", "r", encoding="utf-8",
) as f:
    DEFAULT_PROMPT_TEMPLATE = f.read()
