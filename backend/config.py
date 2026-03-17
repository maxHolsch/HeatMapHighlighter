import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

RAW_TRANSCRIPTS_DIR = BASE_DIR / "cortico_api_transcripts_json"

SNIPPET_SCORES_CACHE_DIR = BASE_DIR / "snippet_highlight_scores_cache"

SPAN_PREDICTIONS_CACHE_DIR = BASE_DIR / "span_highlight_predictions_cache"

SAVED_HIGHLIGHTS_DIR = BASE_DIR / "saved_highlights"

OPENAI_SNIPPET_MODEL = os.environ.get("OPENAI_SNIPPET_MODEL", "gpt-5-2025-08-07")
OPENAI_SPAN_MODEL = os.environ.get("OPENAI_SPAN_MODEL", "gpt-5-mini")

_BACKEND_DIR = BASE_DIR / "backend"

with open(_BACKEND_DIR / "base_prompt.md", "r", encoding="utf-8") as f:
    DEFAULT_PROMPT_TEMPLATE = f.read()

with open(_BACKEND_DIR / "span_prompt_template.md", "r", encoding="utf-8") as f:
    SPAN_PROMPT_TEMPLATE = f.read()
