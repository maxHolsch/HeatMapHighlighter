import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

RAW_TRANSCRIPTS_DIR = BASE_DIR / "cortico_api_transcripts_json"

HIGHLIGHT_CACHE_DIR = BASE_DIR / "highlight_cache"

SAVED_HIGHLIGHTS_DIR = BASE_DIR / "saved_highlights"

END_TO_END = True
DEFAULT_THRESHOLD = 4

OPENAI_SNIPPET_MODEL = os.environ.get("OPENAI_SNIPPET_MODEL", "gpt-5-2025-08-07")
OPENAI_SPAN_MODEL = os.environ.get("OPENAI_SPAN_MODEL", "gpt-5-mini")

_PROMPTS_DIR = BASE_DIR / "backend" / "prompts"

with open(_PROMPTS_DIR / "base_prompt.md", "r", encoding="utf-8") as f:
    DEFAULT_PROMPT_TEMPLATE = f.read()

with open(_PROMPTS_DIR / "base_prompt_modularized.md", "r", encoding="utf-8") as f:
    MODULAR_PROMPT_TEMPLATE = f.read()

with open(_PROMPTS_DIR / "span_prompt_template.md", "r", encoding="utf-8") as f:
    SPAN_PROMPT_TEMPLATE = f.read()

with open(_PROMPTS_DIR / "highlight_definition_base.md", "r", encoding="utf-8") as f:
    DEFAULT_HIGHLIGHT_DEFINITION = f.read()

with open(_PROMPTS_DIR / "conversation_context_base.md", "r", encoding="utf-8") as f:
    DEFAULT_CONVERSATION_CONTEXT = f.read()

with open(_PROMPTS_DIR / "theme_conditioning_instructions.md", "r", encoding="utf-8") as f:
    THEME_CONDITIONING_TEMPLATE = f.read()

with open(_PROMPTS_DIR / "conditioning_theme_base.md", "r", encoding="utf-8") as f:
    DEFAULT_THEME_CONDITIONING = f.read()
