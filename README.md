# LLM-based Automatic Highlighting for Conversations

An interactive tool for detecting, refining, and reviewing highlights in conversation transcripts using LLM-based scoring. Built with a Flask backend and a React (Vite) frontend.

The tool takes raw conversation transcript JSONs taken from the [Cortico API](https://api.cortico.ai/docs#overview), cleans and formats them, and runs a two-stage LLM pipeline:

1. **Snippet-level scoring**: An OpenAI model assigns each paragraph-level snippet a 0-10 highlight score with reasoning. Results are visualized as a heat map.
2. **Span-level refinement**: A second LLM pass takes the above-threshold snippets and identifies precise start/end boundaries within each snippet, producing exact character-level highlight spans for human review.

## Features

### End-to-end pipeline (default mode)

The default mode runs both LLM passes in a single click. Select a conversation, configure the prompt fields, and click **Get AI-Generated Highlights** to get final span-level highlights directly. A confirmation modal reminds you an API call will be made (approximate time: 4–8 minutes).

After the pipeline completes, the view switches to span-level mode automatically. You can toggle back to heat map mode at any time to inspect the snippet-level scores and reasoning from Pass 1.

### Modular prompt configuration

Instead of editing a raw prompt template, you configure three focused fields:

- **What kind of content are you looking to highlight?** — Define what constitutes a highlight (e.g., personal stories, emotional moments). Defaults to a general "powerful or noteworthy moments" definition.
- **Do you want to provide additional context about this conversation?** — Optional background about the conversation setting or participants.
- **Do you want to find content related to a specific topic or theme?** — Optionally focus highlight extraction on a specific topic. Leave blank to find highlights across all topics.

Each field has a question-mark help icon with hover tooltip guidance. A **Preview Full Prompt** button assembles and displays the full prompt that will be sent to the LLM before committing to the API call.

### Pass 1: Snippet-level highlight detection

- **Heat map visualization**: The transcript is rendered with highlighted snippets shaded according to their scores (higher scores produce darker shades).
- **Reasoning tooltips**: Hover over any highlighted snippet to see the LLM's score and reasoning.
- **Snippet merging**: Short single-sentence snippets are merged before being sent to the LLM, then scores are mapped back to the original un-merged snippets for rendering.
- **Cached predictions**: Load previously generated prediction files without re-running the LLM (in two-step mode).

### Pass 2: Span-level highlight refinement

- **Span detection**: Consecutive above-threshold snippets are grouped and sent to a second LLM call. The LLM returns verbatim quoted anchors defining each highlight's start and end; the backend resolves these to exact character offsets (with fuzzy-match fallback).
- **Reasoning tooltips on spans**: Hover over any highlighted span to see the LLM's reasoning for why that span was identified as a highlight. Reasoning persists even after manually adjusting the span boundaries.
- **Cached span predictions**: Span prediction files are saved per conversation and can be reloaded, bypassing the LLM call entirely (in two-step mode).

### Human review

- **Accept / Reject**: Each highlight span has inline Accept and Reject buttons.
- **Undo**: Revert an accepted or rejected highlight back to pending.
- **Accept All**: Accept all pending highlights in one click.
- **Drag to adjust boundaries**: Drag handles at each span boundary to resize the highlight to a word boundary.
- **Add new highlight**: Enable "Add New Highlight" mode, then click and drag over any part of the transcript to create a new pending span. User-created highlights display a "User-created highlight" tooltip on hover.
- **Delete**: Remove a rejected highlight entirely.
- **Progress summary**: The sidebar shows a live count of pending / accepted / rejected highlights.
- **Save Highlights**: Once all highlights are accepted or rejected, save the accepted ones to a JSON file.

### Layout

The UI uses a two-column layout:

- **Left sidebar**: Conversation selector, view mode toggle (Heat Map / Span-Level), highlight summary counters, and action buttons.
- **Right main area**: Modular prompt editor (collapsible) and the full scrollable transcript viewer.

### Two-step mode

Setting `END_TO_END = False` in `backend/config.py` restores the original two-step UI, where Pass 1 and Pass 2 are triggered separately. This mode exposes the predictions file selector, threshold slider, and span predictions file selector in the sidebar, and uses the legacy full-prompt text editor.

## Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- An OpenAI API key with access to the configured models

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
<project_root>/cortico_api_transcripts_json/conversation-*.json
```

The path is configured in `backend/config.py` via `BASE_DIR` and `RAW_TRANSCRIPTS_DIR`. Update these if your data lives elsewhere.

You can download transcript JSON files for conversations from the realtalk@Boston corpus from this [Google Drive link](https://drive.google.com/drive/folders/1nUZpaUcLMpEcn1rHDYlaAQ6Ml83jqEdc?usp=drive_link). Unzip `cortico_api_transcripts_json` into the project's working directory to load transcripts into the UI.

Additionally, if you have pre-computed snippet-level highlight score files, place them under `highlight_cache/<conversation-id>/predictions_*.json` to load them without running Pass 1 (two-step mode only).

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

If running on a remote machine, make sure to set up appropriate port forwarding to access from your local machine.

## Usage

### End-to-end mode (default)

1. **Select a conversation** from the sidebar dropdown. The transcript loads automatically.
2. **Configure the prompt fields** in the Prompt Configuration panel: define what a highlight is, optionally add conversation context, and optionally specify a topic or theme to focus on.
3. **Preview the prompt** (optional): Click "Preview Full Prompt" to inspect the assembled prompt before the API call.
4. **Run the pipeline**: Click **Get AI-Generated Highlights**, confirm the modal, and wait (4–8 minutes). The view switches to Span-Level mode when complete.
5. **Toggle Heat Map**: Use the View Mode toggle in the sidebar to switch between the snippet-level heat map (Pass 1 scores and reasoning) and the span-level highlights editor.
6. **Review highlights**: Accept, reject, undo, or drag-adjust each span. Hover over any span to see the LLM's reasoning. Use "Accept All" to accept all at once. Add new spans manually if needed.
7. **Save highlights**: Once all highlights are decided, click "Save Highlights" to export accepted spans to `saved_highlights/<conversation-id>/`.

### Two-step mode (`END_TO_END = False`)

1. **Select a conversation** from the sidebar dropdown.
2. **Load snippet-level predictions** from the Predictions File dropdown, or run new detection via the Prompt Editor.
3. **Adjust the threshold** to control which snippets appear highlighted.
4. **Hover over highlighted snippets** to read the LLM's score and reasoning.
5. **Get span-level highlights**: With a snippet-level prediction loaded, click "Get Span-Level Highlights". Confirm the modal, then wait for the second-pass LLM call to complete (1–3 minutes). The view switches to Span-Level mode automatically.
   - Alternatively, load a previously cached span prediction from the Span Predictions File dropdown.
6. **Review highlights** and **Complete Highlighting** as above.

## Project structure

```
llm-auto-highlighter/
├── backend/
│   ├── app.py                         # Flask app and all API routes
│   ├── config.py                      # Paths, models, config flags, prompt loading
│   ├── transcript_processor.py        # Transcript cleaning, snippet merging, index mapping
│   ├── prompt_builder.py              # Snippet formatting and prompt assembly (standard + modular)
│   ├── highlight_detector.py          # Pass 1: OpenAI API, score un-merging, prediction I/O
│   ├── span_detector.py               # Pass 2: grouping, span prompt, boundary resolution, I/O
│   ├── requirements.txt
│   └── prompts/                       # Prompt template and component files
│       ├── base_prompt.md             # Legacy full prompt template (two-step mode)
│       ├── base_prompt_modularized.md # Modular prompt template with placeholders
│       ├── highlight_definition_base.md   # Default highlight definition text
│       ├── conversation_context_base.md   # Default conversation context text
│       ├── theme_conditioning_instructions.md  # Template for optional theme conditioning block
│       └── span_prompt_template.md    # Fixed prompt for Pass 2 span-level detection
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
│           ├── ModularPromptEditor.jsx    # Three-field prompt configuration panel
│           ├── PromptEditor.jsx           # Legacy single-textarea prompt editor (two-step mode)
│           ├── PreviewModal.jsx
│           ├── ThresholdControls.jsx
│           ├── TranscriptViewer.jsx
│           ├── SnippetBlock.jsx
│           ├── ReasoningTooltip.jsx
│           ├── HighlightSpanEditor.jsx    # Sidebar summary panel
│           └── HighlightActionButtons.jsx
├── highlight_cache/                   # Unified cache for both LLM passes, per conversation
│   └── <conversation-id>/
│       ├── predictions_<timestamp>.json   # Pass 1 snippet scores
│       └── spans_<timestamp>.json         # Pass 2 span predictions
├── saved_highlights/                  # Finalized accepted highlight exports
│   └── <conversation-id>/
└── README.md
```

## Cache file structure

Both LLM pass outputs are stored together under `highlight_cache/<conversation-id>/`, distinguished by filename prefix:

- `predictions_<timestamp>.json` — raw Pass 1 LLM output (paragraph scores and reasoning)
- `spans_<timestamp>.json` — Pass 2 span predictions, including a `source_predictions_file` field that links back to the corresponding Pass 1 file

In end-to-end mode, both files for a single run share the same timestamp, making the pairing unambiguous.

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Return `end_to_end` flag and `default_threshold` |
| GET | `/api/prompt-components` | Return default values for modular prompt fields |
| GET | `/api/conversations` | List available conversation IDs |
| GET | `/api/conversations/<id>/transcript` | Original + merged snippets and merge mapping |
| GET | `/api/conversations/<id>/predictions` | List snippet-level prediction filenames |
| GET | `/api/conversations/<id>/predictions/<file>` | Load and un-merge a prediction file |
| POST | `/api/conversations/<id>/preview-prompt` | Preview assembled legacy prompt |
| POST | `/api/conversations/<id>/preview-prompt-modular` | Preview assembled modular prompt |
| POST | `/api/conversations/<id>/detect-highlights` | Run Pass 1 LLM detection, save and return results |
| POST | `/api/conversations/<id>/detect-highlights-e2e` | Run both passes end-to-end, save and return results |
| POST | `/api/conversations/<id>/detect-spans` | Run Pass 2 span detection only, save and return results |
| GET | `/api/conversations/<id>/span-predictions` | List span prediction filenames |
| GET | `/api/conversations/<id>/span-predictions/<file>` | Load a span prediction file |
| POST | `/api/conversations/<id>/highlights/save` | Save finalized accepted highlights |
| GET | `/api/default-prompt` | Get the default legacy prompt template |

## Configuration

All configuration is centralized in `backend/config.py`:

| Variable | Default | Description |
|----------|---------|-------------|
| `END_TO_END` | `True` | Run both LLM passes in a single click; set to `False` for the original two-step UI |
| `DEFAULT_THRESHOLD` | `4` | Score threshold used in end-to-end mode to select snippets for Pass 2 |
| `BASE_DIR` | `llm-auto-highlighter` | Project root directory |
| `RAW_TRANSCRIPTS_DIR` | `<BASE_DIR>/cortico_api_transcripts_json` | Directory containing raw transcript JSONs |
| `HIGHLIGHT_CACHE_DIR` | `<BASE_DIR>/highlight_cache` | Unified cache for Pass 1 and Pass 2 LLM outputs |
| `SAVED_HIGHLIGHTS_DIR` | `<BASE_DIR>/saved_highlights` | Finalized highlight exports |
| `OPENAI_SNIPPET_MODEL` | `gpt-5-2025-08-07` | Model used for Pass 1 snippet-level scoring |
| `OPENAI_SPAN_MODEL` | `gpt-5-mini` | Model used for Pass 2 span boundary extraction |
