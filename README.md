# llm-auto-highlighter

An interactive tool for detecting, refining, and reviewing highlights in conversation transcripts using LLM-based scoring. Built with a Flask backend and a React (Vite) frontend.

The tool takes raw conversation transcript JSONs taken from the [Cortico API](https://api.cortico.ai/docs#overview), cleans and formats them, and runs a two-stage LLM pipeline:

1. **Snippet-level scoring** -- An OpenAI model assigns each paragraph-level snippet a 0-10 highlight score with reasoning. Results are visualized as a heat map.
2. **Span-level refinement** -- A second LLM pass takes the above-threshold snippets and identifies precise start/end boundaries within each snippet, producing exact character-level highlight spans for human review.

## Features

### Pass 1: Snippet-level highlight detection

- **Customizable prompt** -- Edit the full prompt template in the UI before running.
- **Heat map visualization** -- The transcript is rendered with highlighted snippets shaded according to their scores (higher scores produce darker shades).
- **Threshold slider** -- Interactively adjust the score threshold (1–10) to control which snippets are highlighted.
- **Reasoning tooltips** -- Hover over any highlighted snippet to see the LLM's reasoning for the score.
- **Cached predictions** -- Load previously generated prediction files without re-running the LLM.
- **Snippet merging** -- Short single-sentence snippets are merged before being sent to the LLM, then scores are mapped back to the original un-merged snippets for rendering.

### Pass 2: Span-level highlight refinement

- **Span detection** -- Clicking "Get Span-Level Highlights" groups consecutive above-threshold snippets, sends them to a second LLM call, and receives verbatim quoted anchors defining each highlight's start and end. The backend resolves these to exact character offsets (with fuzzy-match fallback).
- **Cached span predictions** -- Span prediction files are saved per conversation and can be reloaded from a dropdown, bypassing the LLM call entirely.
- **Final Highlights mode** -- Toggle from Heat Map to Span-Level Highlights view to see only the precise highlighted spans rendered inline within the transcript.

### Human review

- **Accept / Reject** -- Each highlight span has inline Accept and Reject buttons.
- **Undo** -- Revert an accepted or rejected highlight back to pending.
- **Accept All** -- Accept all pending highlights in one click.
- **Drag to adjust boundaries** -- Drag handles at each span boundary to resize the highlight to a word boundary.
- **Add new highlight** -- Enable "Add New Highlight" mode, then click and drag over any part of the transcript to create a new pending span.
- **Delete** -- Remove a rejected highlight entirely.
- **Progress summary** -- The sidebar shows a live count of pending / accepted / rejected highlights.
- **Complete Highlighting** -- Once all highlights are accepted or rejected, save the accepted ones to a JSON file.

### Layout

The UI uses a two-column layout:

- **Left sidebar** (sticky) -- All controls: conversation selector, predictions dropdowns, threshold slider, view mode toggle, span action buttons, and highlight summary.
- **Right main area** -- Prompt editor (collapsible) and the full scrollable transcript viewer.

## Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- An OpenAI API key with access to the configured models

## Project structure

```
llm-auto-highlighter/
├── backend/
│   ├── app.py                         # Flask app and all API routes
│   ├── config.py                      # Paths, model names, prompt templates
│   ├── transcript_processor.py        # Transcript cleaning, snippet merging, index mapping
│   ├── prompt_builder.py              # Snippet formatting and prompt assembly
│   ├── highlight_detector.py          # Pass 1: OpenAI API, score un-merging, prediction I/O
│   ├── span_detector.py               # Pass 2: grouping, span prompt, boundary resolution, I/O
│   ├── base_prompt.md                 # Default user-editable prompt template
│   ├── span_prompt_template.md        # Fixed hidden prompt for span-level detection
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                    # Main application state and layout
│       ├── App.css                    # All styles
│       ├── api.js                     # Fetch wrappers for all backend endpoints
│       └── components/
│           ├── ConversationSelector.jsx
│           ├── PredictionsFileSelector.jsx
│           ├── PromptEditor.jsx
│           ├── PreviewModal.jsx
│           ├── ThresholdControls.jsx
│           ├── TranscriptViewer.jsx
│           ├── SnippetBlock.jsx
│           ├── ReasoningTooltip.jsx
│           ├── HighlightSpanEditor.jsx    # Sidebar summary panel
│           └── HighlightActionButtons.jsx
├── highlight_predictions_cache/       # Pass 1 cached LLM outputs, per conversation/theme
│   └── <conversation-id>/
├── span_highlight_predictions_cache/  # Pass 2 cached span predictions
│   └── <conversation-id>/
├── saved_highlights/                  # Finalized accepted highlight exports
│   └── <conversation-id>/
└── README.md
```

## Setup

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
```

### 2. Frontend

```bash
cd frontend
npm install
```

### 3. Environment

Set your OpenAI API key:

```bash
export OPENAI_API_KEY="sk-..."
```

Optionally override the default models:

```bash
export OPENAI_SNIPPET_MODEL="gpt-5"   # Pass 1 (default: gpt-5-2025-08-07)
export OPENAI_SPAN_MODEL="gpt-5-mini" # Pass 2 (default: gpt-5-mini)
```

### 4. Data

The backend expects raw Cortico transcript JSONs at:

```
<project_root>/data/cortico/realtalk_boston/api_orig_transcripts_json/conversation-*.json
```

The path is configured in `backend/config.py` via `BASE_DIR` and `RAW_TRANSCRIPTS_DIR`. Update these if your data lives elsewhere.

## Running

Start both servers (each in its own terminal):

**Backend** (port 5000):

```bash
cd backend
python app.py
```

**Frontend** (port 3000, proxies `/api` to the backend):

```bash
cd frontend
npm run dev
```

Then open http://localhost:3000 in your browser.

## Usage

1. **Select a conversation** from the sidebar dropdown. The transcript and available prediction files load automatically.
2. **Load snippet-level predictions** from the Predictions File dropdown, or run new detection via the Prompt Editor.
3. **Adjust the threshold** to control which snippets appear highlighted.
4. **Hover over highlighted snippets** to read the LLM's reasoning.
5. **Get span-level highlights** -- with a snippet-level prediction loaded, click "Get Span-Level Highlights". Confirm the modal, then wait for the second-pass LLM call to complete. The view switches automatically to Final Highlights mode.
   - Alternatively, load a previously cached span prediction from the Span Predictions File dropdown.
6. **Review highlights** -- Accept, reject, undo, or drag-adjust each span. Use "Accept All" to accept all at once. Add new spans manually if needed.
7. **Complete highlighting** -- Once all highlights are decided, click "Complete Highlighting" to save accepted spans to `saved_highlights/<conversation-id>/`.

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List available conversation IDs |
| GET | `/api/conversations/<id>/transcript` | Original + merged snippets and merge mapping |
| GET | `/api/conversations/<id>/predictions` | List snippet-level prediction filenames |
| GET | `/api/conversations/<id>/predictions/<file>` | Load and un-merge a prediction file |
| POST | `/api/conversations/<id>/preview-prompt` | Preview the assembled prompt |
| POST | `/api/conversations/<id>/detect-highlights` | Run Pass 1 LLM detection, save and return results |
| POST | `/api/conversations/<id>/detect-spans` | Run Pass 2 span detection, save and return results |
| GET | `/api/conversations/<id>/span-predictions` | List span prediction filenames |
| GET | `/api/conversations/<id>/span-predictions/<file>` | Load a span prediction file |
| POST | `/api/conversations/<id>/highlights/save` | Save finalized accepted highlights |
| GET | `/api/default-prompt` | Get the default prompt template |

## Configuration

All configuration is centralized in `backend/config.py`:

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_DIR` | `/home/wjkang/projects/highlight_extraction` | Project root for resolving data paths |
| `RAW_TRANSCRIPTS_DIR` | `<BASE_DIR>/data/.../api_orig_transcripts_json` | Directory containing raw transcript JSONs |
| `PREDICTIONS_CACHE_DIR` | `llm-auto-highlighter/highlight_predictions_cache` | Pass 1 prediction cache |
| `SPAN_PREDICTIONS_CACHE_DIR` | `llm-auto-highlighter/span_highlight_predictions_cache` | Pass 2 span prediction cache |
| `SAVED_HIGHLIGHTS_DIR` | `llm-auto-highlighter/saved_highlights` | Finalized highlight exports |
| `OPENAI_SNIPPET_MODEL` | `gpt-5-2025-08-07` | Model used for Pass 1 snippet scoring |
| `OPENAI_SPAN_MODEL` | `gpt-5-mini` | Model used for Pass 2 span boundary extraction |
