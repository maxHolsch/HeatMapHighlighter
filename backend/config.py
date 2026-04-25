import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Load a repo-root .env so ANTHROPIC_API_KEY + Wonjune paths resolve
# without needing to `source` before every run. dotenv is shipped via
# uvicorn[standard] so it's already in our venv.
try:
    from dotenv import load_dotenv
    # override=True so a stale/placeholder value already in the shell
    # (e.g. a leftover sk-ant-... from .env.example) cannot mask the real
    # key written to .env. The file on disk is the source of truth.
    load_dotenv(BASE_DIR / ".env", override=True)
except ImportError:
    pass

RAW_TRANSCRIPTS_DIR = BASE_DIR / "cortico_api_transcripts_json"

HIGHLIGHT_CACHE_DIR = BASE_DIR / "highlight_cache"

SAVED_HIGHLIGHTS_DIR = BASE_DIR / "saved_highlights"

# Heatmap / corpus-scoped state (SQLite, vectors, ingested audio).
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR / "data"))
AUDIO_DIR = DATA_DIR / "audio"
VECTORS_DIR = DATA_DIR / "vectors"
ANTHOLOGIES_DIR = DATA_DIR / "anthologies"
CLIPS_DIR = DATA_DIR / "clips"
EXPLANATION_CACHE_DIR = DATA_DIR / "explanations"
DB_PATH = DATA_DIR / "corpus.db"

END_TO_END = True
DEFAULT_THRESHOLD = 4

# Anthropic models. Opus for the two expensive highlighter passes by default
# because prompt is long and correctness matters; Sonnet for fast query
# planning / explanations / style queries.
ANTHROPIC_SNIPPET_MODEL = os.environ.get(
    "ANTHROPIC_SNIPPET_MODEL", "claude-opus-4-7"
)
ANTHROPIC_SPAN_MODEL = os.environ.get(
    "ANTHROPIC_SPAN_MODEL", "claude-sonnet-4-6"
)
ANTHROPIC_PLANNER_MODEL = os.environ.get(
    "ANTHROPIC_PLANNER_MODEL", "claude-sonnet-4-6"
)
ANTHROPIC_EXPLAIN_MODEL = os.environ.get(
    "ANTHROPIC_EXPLAIN_MODEL", "claude-sonnet-4-6"
)

# Retrieval / ASR / encoders.
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "medium")
WHISPER_COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")

TOPIC_MODEL = os.environ.get(
    "TOPIC_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)
TOPIC_EMBED_DIM = 384
STYLE_EMBED_DIM = 512

# Wonjune expressive speech retrieval checkpoint. Required at startup for any
# audio-scoped feature; app refuses to touch audio without a real checkpoint.
WONJUNE_REPO_DIR = Path(
    os.environ.get(
        "WONJUNE_REPO_DIR",
        BASE_DIR.parent / "expressive-speech-retrieval",
    )
)
WONJUNE_CONFIG = os.environ.get(
    "WONJUNE_CONFIG", "config/roberta_emotion2vec.yaml"
)
WONJUNE_CHECKPOINT_PATH = os.environ.get("WONJUNE_CHECKPOINT_PATH", "")
WONJUNE_DEVICE = os.environ.get("WONJUNE_DEVICE", "cpu")

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


def ensure_data_dirs() -> None:
    """Create all data directories that live under DATA_DIR."""
    for d in (
        DATA_DIR,
        AUDIO_DIR,
        VECTORS_DIR,
        ANTHOLOGIES_DIR,
        CLIPS_DIR,
        EXPLANATION_CACHE_DIR,
    ):
        d.mkdir(parents=True, exist_ok=True)


def require_anthropic_key() -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Export it before starting the backend."
        )
