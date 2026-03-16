# llm-auto-highlighter

An interactive tool for detecting and visualizing highlights in conversation transcripts using LLM-based scoring. Built with a Flask backend and a React (Vite) frontend.

The tool takes raw conversation transcript JSONs from the [Cortico RealTalk](https://cortico.ai/) platform, cleans and formats them, feeds them through an OpenAI LLM to get snippet-level highlight scores, and renders the results in a heat map visualizer where the user can explore scores, adjust thresholds, and read the LLM's reasoning for each snippet.

## Features

- **Highlight detection** -- Send a conversation transcript to an OpenAI model with a customizable prompt template. The LLM returns a 0-10 highlight score for each paragraph-level snippet.
- **Heat map visualization** -- View the full transcript with highlighted snippets shaded in purple. Higher scores produce darker shades; snippets below the threshold are unshaded.
- **Threshold slider** -- Interactively adjust the score threshold (1-10) to control which snippets are highlighted.
- **Reasoning tooltips** -- Hover over any highlighted snippet to see the LLM's reasoning in a tooltip that follows the cursor.
- **Cached predictions** -- Load previously generated prediction files (e.g., per-theme outputs) without re-running the LLM.
- **Prompt editor** -- Edit the full prompt template in the UI before running detection; preview the assembled prompt before making the API call.
- **Snippet merging** -- Short (single-sentence) snippets are merged before being sent to the LLM, then scores are mapped back to the original un-merged snippets for rendering.

### Scaffolded for future work

The following features are structurally scaffolded but not yet active, pending a second-pass LLM refinement step:

- **Final Highlights mode** -- Toggle between heat map view and a precise span-level highlight view.
- **Accept/reject buttons** -- Inline buttons on each highlight span for human review.
- **Span editing** -- Drag to adjust highlight start/end boundaries.
- **Manual highlight creation** -- Select text to create new highlight spans.
- **Highlight export** -- Save finalized, accepted highlights to a JSON file.

## Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- An OpenAI API key with access to the configured model

## Project structure

```
llm-auto-highlighter/
├── backend/
│   ├── app.py                    # Flask app and API routes
│   ├── config.py                 # Paths, model config, default prompt template
│   ├── transcript_processor.py   # Transcript cleaning, snippet merging, index mapping
│   ├── prompt_builder.py         # Snippet formatting and prompt assembly
│   ├── highlight_detector.py     # OpenAI API calls, score un-merging, prediction I/O
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx               # Main application state and layout
│       ├── App.css               # All styles (heat map palette, modals, tooltips)
│       ├── api.js                # Fetch wrappers for backend endpoints
│       └── components/
│           ├── ConversationSelector.jsx
│           ├── PredictionsFileSelector.jsx
│           ├── PromptEditor.jsx
│           ├── PreviewModal.jsx
│           ├── ThresholdControls.jsx
│           ├── TranscriptViewer.jsx
│           ├── SnippetBlock.jsx
│           ├── ReasoningTooltip.jsx
│           ├── HighlightSpanEditor.jsx    # (scaffolded)
│           └── HighlightActionButtons.jsx # (scaffolded)
├── highlight_predictions_cache/  # Cached LLM predictions (per conversation / theme)
├── saved_highlights/             # Exported finalized highlights
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

Optionally override the default model (defaults to `gpt-5-2025-08-07`):

```bash
export OPENAI_MODEL="gpt-4o"
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

1. **Select a conversation** from the dropdown. The transcript loads and available prediction files are listed.
2. **Load cached predictions** by selecting a file from the Predictions File dropdown (e.g., `theme1_gpt-5-2025-08-07.json`). The heat map renders immediately.
3. **Adjust the threshold** with the slider to control which snippets are highlighted.
4. **Hover over highlighted snippets** to see the LLM's reasoning in a tooltip.
5. **Run new detection** by expanding the Prompt Editor, editing the template as needed, and clicking "Run Highlight Detection". A preview modal shows the assembled prompt before the API call is made.

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List available conversation IDs |
| GET | `/api/conversations/<id>/transcript` | Original + merged snippets and merge mapping |
| GET | `/api/conversations/<id>/predictions` | List prediction filenames |
| GET | `/api/conversations/<id>/predictions/<file>` | Load and un-merge a prediction file |
| POST | `/api/conversations/<id>/preview-prompt` | Preview the assembled prompt |
| POST | `/api/conversations/<id>/detect-highlights` | Run LLM detection, save and return results |
| POST | `/api/conversations/<id>/highlights/save` | Save finalized highlights |
| GET | `/api/default-prompt` | Get the default prompt template |

## Configuration

All configuration is centralized in `backend/config.py`:

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_DIR` | `/home/wjkang/projects/highlight_extraction` | Project root for resolving data paths |
| `RAW_TRANSCRIPTS_DIR` | `<BASE_DIR>/data/.../api_orig_transcripts_json` | Directory containing raw transcript JSONs |
| `PREDICTIONS_CACHE_DIR` | `llm-auto-highlighter/highlight_predictions_cache` | Where prediction JSONs are read from and saved to |
| `SAVED_HIGHLIGHTS_DIR` | `llm-auto-highlighter/saved_highlights` | Where finalized highlight exports are written |
| `OPENAI_MODEL` | `gpt-5-2025-08-07` (or `OPENAI_MODEL` env var) | Model used for highlight detection |
