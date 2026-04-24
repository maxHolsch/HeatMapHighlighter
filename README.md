# Conversation Heatmap + Auto-Highlighter

A unified web tool for finding salient moments in recorded conversations. Two views share one app:

1. **Auto-Highlighter** (primary) — open one conversation at a time. A two-pass LLM pipeline scores paragraph-level snippets 0–10 (Pass 1, heatmap-style in-conversation) then refines above-threshold regions into character-level spans (Pass 2). Curator accepts / rejects / drags / adds spans, then lifts accepted spans to an anthology.
2. **Corpus Heatmap** (secondary toggle) — a cross-conversation fan grid. Every snippet in every conversation is visible at once. Natural-language queries ("frustrated moments about housing") are decomposed via Claude into style + topic axes, scored against Wonjune's expressive-speech embeddings + sentence-transformers topical embeddings, and rendered as heat on top of the full corpus (non-matching snippets grey out — the corpus is never hidden).

Both surfaces feed the same **Anthology Workspace**, where clips are arranged into sections with curator notes and exported as (a) a working dataset bundle and (b) a self-contained karaoke HTML player with word-level transcript synchronization.

All LLM calls (Pass 1, Pass 2, query planner, "why salient" explanations) go through Anthropic Claude. Paralinguistic retrieval uses Wonjune Kang's [expressive-speech-retrieval](../expressive-speech-retrieval/) checkpoint.

---

## Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- `ffmpeg` (for audio loading)
- An Anthropic API key (`ANTHROPIC_API_KEY`)
- (Optional, for paralinguistic audio features) Wonjune's roberta_emotion2vec checkpoint, placed anywhere on disk and pointed at via `WONJUNE_CHECKPOINT_PATH`. Without this, topical queries still work; style queries are disabled with a clear error.

## Setup

```bash
cd backend
pip install -r requirements.txt
# Make Wonjune's model code importable:
pip install -e ../../expressive-speech-retrieval 2>/dev/null || true  # not strictly required; sys.path fallback also works

cd ../frontend
npm install
```

Copy `.env.example` to `.env` and fill in:

```
ANTHROPIC_API_KEY=sk-ant-...
WONJUNE_CHECKPOINT_PATH=/abs/path/to/roberta_emotion2vec.pt   # optional
WONJUNE_CONFIG=config/roberta_emotion2vec.yaml                # relative to expressive-speech-retrieval/
WHISPER_MODEL=medium
```

The backend refuses to start without `ANTHROPIC_API_KEY`. The style encoder lazy-fails with a clear error the first time you try to run a style-axis query or ingest audio; other features continue to work.

## Running

Two terminals:

**Backend** (port 5000):

```bash
cd backend
python app.py
```

**Frontend** (port 3000, proxies `/api` → backend):

```bash
cd frontend
npm run dev
```

Then open http://localhost:3000/.

## Ingesting conversations into the corpus

The Auto-Highlighter works directly off Cortico JSON files in `cortico_api_transcripts_json/` and requires no ingestion step. But for the Corpus Heatmap and the Anthology Workspace to see a conversation, run the ingestion script:

```bash
# Text-only (topical axis available, no style axis):
python scripts/ingest.py --corpus "my-corpus" --cortico-dir ./cortico_api_transcripts_json/

# Audio-only (ASR runs; both axes available):
python scripts/ingest.py --corpus "my-corpus" --audio-dir /path/to/audio/

# Cortico JSON paired with matching WAV files by stem:
python scripts/ingest.py --corpus "my-corpus" \
    --cortico-dir ./cortico_api_transcripts_json/ \
    --audio-dir /path/to/audio/
```

Re-running the script on the same `(corpus, title)` replaces existing embeddings.

## Smoke test flow

1. Start backend + frontend.
2. Nav to **Auto-Highlighter** (default). Select a Cortico conversation, configure the prompt fields, click **Get AI-Generated Highlights**. Wait 4–8 min. Accept a few spans, click **Lift accepted to anthology**.
3. Nav to **Anthologies** → open the newly-created anthology. Add a section, drag some clips around, add a curator note, add a preface. Click **Export dataset + karaoke** → open the karaoke `index.html` from the downloaded zip — confirm word-sync highlighting plays in a browser.
4. (With a Wonjune checkpoint installed) run the ingest script, then nav to **Corpus Heatmap**. Type a query like "moments where people got frustrated talking about housing". Confirm the style/topic decomposition renders, heat appears on the fans, non-matching snippets grey out. Click a hot snippet → detail panel shows transcript + audio; click **Open in Auto-Highlighter →** to jump back.

## Features

### Auto-Highlighter

(Same flow as the original highlighter — prompt configuration, heat-map + span-level views, accept/reject/drag/add/delete, Save Highlights — now with Claude under the hood via tool-use for structured output.)

New: **Lift accepted to anthology** — button alongside Save Highlights. All accepted spans flow as clips into an anthology named `<conversation> highlights` (created on demand), with each span's LLM reasoning captured as the curator note.

### Corpus Heatmap

- **Fan grid canvas**: every conversation is a vertical fan of snippet lines; every line is always visible.
- **Query bar**: natural-language input ("angry moments about rent"). Claude decomposes into `{style, topic}`; decomposition is rendered and editable above the canvas so the user can correct misreadings.
- **Axis controls**: style toggle, topic toggle, blend slider, grey-out threshold slider.
- **Grey-out only**: non-matching snippets fade to low alpha. The corpus is never filtered.
- **Shift+drag lasso**: "more like this" — pulls an averaged style+topic signature from the selected rectangle and re-scores everything against it.
- **Tooltips**: hover any snippet for preview text + per-axis scores.
- **Detail panel**: transcript + ±30 s surrounding context + audio player (if audio available) + **Why is this salient?** (LLM explanation, cached) + lift-to-anthology with draggable start/end.
- **Cross-view**: "Open in Auto-Highlighter →" pre-fills the prompt theme from the current topical query.

### Anthology Workspace

- Editable preface, reorderable sections (title + intro), clips with curator notes and configurable boundaries.
- Auto-save on blur.
- Two exports produced together as a single zip:
  - `dataset.zip` — `anthology.json` + `transcripts/` + `audio/` + `README.md`
  - `karaoke.zip` — self-contained `index.html` bundle with word-synced transcript display (relative-path audio; `embed=true` option embeds as base64 for a single-file artifact).

## Project structure

```
llm-auto-highlighter/
├── backend/
│   ├── app.py                 # FastAPI app, mounts corpus + anthology routers
│   ├── config.py              # env, paths, model IDs, ensure_data_dirs/require_key
│   ├── db.py                  # SQLModel schema: Corpus/Conversation/Snippet/Word/Anthology/Section/Clip/Explanation
│   ├── llm_client.py          # Anthropic tool-use wrapper (run_structured, run_text)
│   ├── highlight_detector.py  # Pass 1 via Claude + score un-merging + cache I/O
│   ├── span_detector.py       # Pass 2 via Claude + anchor→char-offset + grouping + cache I/O
│   ├── transcript_processor.py# Cortico JSON cleaning + snippet merging
│   ├── prompt_builder.py      # Legacy + modular prompt assembly
│   ├── routes_corpus.py       # /api/corpora, /api/snippets, /api/conversations/{id}/audio, /api/cortico/*/register
│   ├── routes_anthology.py    # /api/anthologies, /api/clips, /api/sections, /api/anthologies/*/export
│   ├── encoders/
│   │   ├── style.py           # Wonjune wrappers; fail-loud if checkpoint missing
│   │   └── topic.py           # sentence-transformers/all-MiniLM-L6-v2
│   ├── audio/
│   │   ├── prep.py            # 16 kHz mono WAV prep + slicing
│   │   ├── asr.py             # faster-whisper
│   │   ├── segment.py         # 3–15 s snippet shaping
│   │   └── pipeline.py        # orchestrator: audio / cortico / paired
│   ├── retrieval/
│   │   ├── planner.py         # NL → {style, topic} via Claude tool-use
│   │   ├── search.py          # cosine + RRF/weighted/max fusion + signature
│   │   └── explain.py         # "why salient", per-(snippet, query) cached
│   ├── anthology/
│   │   ├── service.py         # CRUD
│   │   └── export.py          # dataset .zip + karaoke HTML bundle
│   └── prompts/               # (unchanged)
├── frontend/
│   ├── src/
│   │   ├── main.jsx           # HashRouter
│   │   ├── App.jsx            # Auto-Highlighter (route "/")
│   │   ├── views/
│   │   │   ├── Shell.jsx              # top-nav layout
│   │   │   ├── CorpusHeatMap.jsx      # route "/corpus"
│   │   │   ├── AnthologyList.jsx      # route "/anthologies"
│   │   │   ├── AnthologyWorkspace.jsx # route "/anthologies/:id"
│   │   │   └── views.css
│   │   └── components/
│   │       ├── FanGridCanvas.jsx      # canvas heatmap grid with lasso
│   │       ├── QueryBar.jsx
│   │       ├── AxisControls.jsx
│   │       ├── DetailPanel.jsx        # audio + transcript + explain + lift
│   │       └── (original highlighter components)
│   └── package.json
├── scripts/
│   └── ingest.py              # CLI: ASR + embed for audio and/or Cortico JSON
├── data/                      # gitignored; created at startup
│   ├── corpus.db
│   ├── audio/
│   ├── vectors/{corpus_id}/{style,topic}.npy
│   └── ...
├── highlight_cache/           # (unchanged, per-conversation pass 1 + 2 outputs)
├── saved_highlights/          # (unchanged, finalized accepted highlight JSON)
└── .env.example
```

## API summary (new endpoints only)

| Method | Endpoint | Purpose |
|---|---|---|
| GET  | `/api/corpora` | List corpora |
| GET  | `/api/corpora/{id}/conversations` | List conversations in a corpus |
| GET  | `/api/corpora/{id}/snippets` | All snippets grouped by conversation (for fan grid) |
| POST | `/api/corpora/{id}/query` | NL query → per-snippet scores + decomposition |
| POST | `/api/corpora/{id}/similar` | "More like this" from `snippet_ids` |
| GET  | `/api/snippets/{id}` | Snippet + ±3 neighbor snippets + words |
| POST | `/api/snippets/{id}/explain` | Cached "why salient" one-liner |
| GET  | `/api/conversations/{id}/audio?start=&end=` | WAV stream (full or sliced) |
| POST | `/api/cortico/{name}/register` | Register a Cortico conversation into the default corpus for anthology linking |
| GET/POST/PATCH/DELETE | `/api/anthologies`, `/api/sections`, `/api/clips` | Anthology CRUD |
| GET  | `/api/anthologies/{id}/export?format=dataset\|karaoke\|both&embed=` | Export zip |

## Configuration

All runtime config is in `backend/config.py` and can be overridden by env vars. Key knobs:

| Variable | Default | |
|---|---|---|
| `END_TO_END` | `True` | Run Pass 1 + Pass 2 in one click |
| `DEFAULT_THRESHOLD` | `4` | Pass-2 candidate threshold |
| `ANTHROPIC_SNIPPET_MODEL` | `claude-opus-4-7` | Pass 1 model |
| `ANTHROPIC_SPAN_MODEL` | `claude-sonnet-4-6` | Pass 2 model |
| `ANTHROPIC_PLANNER_MODEL` | `claude-sonnet-4-6` | Query decomposition |
| `ANTHROPIC_EXPLAIN_MODEL` | `claude-sonnet-4-6` | "Why salient" |
| `WHISPER_MODEL` | `medium` | faster-whisper size |
| `WHISPER_COMPUTE_TYPE` | `int8` | |
| `WONJUNE_CHECKPOINT_PATH` | (unset) | Enables style-axis features |
| `DATA_DIR` | `./data` | Corpus DB + vectors + audio cache |

## Known limitations (by design, not bugs)

- The Corpus Heatmap style axis requires a Wonjune checkpoint. Without one, the style toggle can be kept off and topical queries work fine.
- "More like this" needs at least one embedded snippet in the selection.
- `data/corpus.db` migrations are done via SQLModel's `create_all` — no Alembic. Blow it away to reset the corpus state.
- Anthology re-import from zip is not wired in v1 (export works in both directions; import is a future addition).
