"""
Anthology exports:
    - Working dataset: anthology.json + transcripts/ + audio/ + README.md
    - Karaoke HTML bundle: self-contained player with word-sync highlighting

Both are zipped into one .zip; downstream the UI exposes either/both.
"""

from __future__ import annotations

import io
import json
import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

import numpy as np
import soundfile as sf
from sqlmodel import select

from audio.prep import TARGET_SR, load_mono_16k, slice_samples
from db import Anthology, Clip, Conversation, Section, Snippet, Word, session

from .service import get_anthology, clip_transcript


# ---------------------------------------------------------------------------
# Clip audio cutting
# ---------------------------------------------------------------------------

def _cut_clip_wav(audio_path: str, start_sec: float, end_sec: float) -> bytes:
    """Return WAV bytes for the audio slice [start, end]."""
    samples = load_mono_16k(audio_path)
    clip = slice_samples(samples, start_sec, end_sec)
    buf = io.BytesIO()
    sf.write(buf, clip, TARGET_SR, subtype="PCM_16", format="WAV")
    return buf.getvalue()


def _clip_filename(clip_id: int) -> str:
    return f"clip_{clip_id:06d}.wav"


# ---------------------------------------------------------------------------
# Dataset export
# ---------------------------------------------------------------------------

def build_dataset_zip(anth_id: int) -> bytes:
    """Return a .zip containing the full working-dataset anthology bundle."""
    anth = get_anthology(anth_id)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        manifest = {
            "id": anth["id"],
            "name": anth["name"],
            "preface": anth["preface"],
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "sections": [],
        }
        readme_lines = [f"# {anth['name']}", ""]
        if anth["preface"]:
            readme_lines += [anth["preface"], ""]

        with session() as s:
            for sec in anth["sections"]:
                section_manifest = {
                    "id": sec["id"],
                    "idx": sec["idx"],
                    "title": sec["title"],
                    "intro": sec["intro"],
                    "clips": [],
                }
                if sec["title"] or sec["intro"]:
                    readme_lines += [f"## {sec['title'] or '(untitled section)'}", ""]
                    if sec["intro"]:
                        readme_lines += [sec["intro"], ""]
                for clip in sec["clips"]:
                    conv = s.get(Conversation, clip["conversation_id"])
                    if not conv:
                        continue
                    transcript = clip_transcript(
                        clip["conversation_id"],
                        clip["start_sec"],
                        clip["end_sec"],
                    )
                    clip_manifest = {
                        "id": clip["id"],
                        "idx": clip["idx"],
                        "conversation_id": clip["conversation_id"],
                        "conversation_title": conv.title,
                        "start_sec": clip["start_sec"],
                        "end_sec": clip["end_sec"],
                        "tags": clip["tags"],
                        "curator_note": clip["curator_note"],
                        "source": clip["source"],
                    }
                    # Transcript JSON
                    zf.writestr(
                        f"transcripts/{_clip_filename(clip['id']).replace('.wav', '.json')}",
                        json.dumps(transcript, indent=2, ensure_ascii=False),
                    )
                    # Audio WAV (only if source audio is available)
                    if conv.audio_path and Path(conv.audio_path).is_file():
                        wav_bytes = _cut_clip_wav(
                            conv.audio_path, clip["start_sec"], clip["end_sec"]
                        )
                        zf.writestr(f"audio/{_clip_filename(clip['id'])}", wav_bytes)
                        clip_manifest["audio"] = f"audio/{_clip_filename(clip['id'])}"
                    section_manifest["clips"].append(clip_manifest)

                    # README
                    if clip["curator_note"]:
                        readme_lines += [f"> {clip['curator_note']}", ""]
                    readme_lines += [
                        f"- *{conv.title}* "
                        f"[{_fmt_time(clip['start_sec'])}–{_fmt_time(clip['end_sec'])}]",
                    ]
                manifest["sections"].append(section_manifest)
                readme_lines.append("")

        zf.writestr("anthology.json", json.dumps(manifest, indent=2, ensure_ascii=False))
        zf.writestr(
            "metadata.json",
            json.dumps(
                {"tool": "heatmap-highlighter", "version": "0.1.0", "format": "anthology-v1"},
                indent=2,
            ),
        )
        zf.writestr("README.md", "\n".join(readme_lines))

    return buf.getvalue()


def _fmt_time(sec: float) -> str:
    m, s = divmod(int(sec), 60)
    return f"{m:02d}:{s:02d}"


# ---------------------------------------------------------------------------
# Karaoke HTML bundle
# ---------------------------------------------------------------------------

KARAOKE_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
  body { font-family: Georgia, serif; max-width: 760px; margin: 40px auto; padding: 0 24px; color: #222; line-height: 1.55; }
  h1 { font-size: 1.8rem; }
  h2 { margin-top: 2.2rem; font-size: 1.35rem; color: #444; }
  .preface, .intro, .note { color: #555; font-style: italic; }
  .note { border-left: 3px solid #ddd; padding-left: 12px; margin: 12px 0; }
  .clip { margin: 32px 0; padding: 20px; background: #fafafa; border-radius: 6px; }
  .controls { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
  button.play { background: #222; color: white; border: 0; padding: 8px 14px; border-radius: 4px; cursor: pointer; }
  .transcript { font-size: 1.05rem; line-height: 1.7; }
  .word { padding: 1px 2px; border-radius: 3px; transition: background 0.1s; }
  .word.active { background: #ffe58a; }
  .word.past { color: #888; }
  .source { font-size: 0.85rem; color: #888; margin-top: 10px; }
</style>
</head>
<body>
<h1>{title}</h1>
{preface_html}
<div id="anthology"></div>
<script>
const anthology = {anthology_json};

function renderClip(container, clip) {
  const wrap = document.createElement('div');
  wrap.className = 'clip';
  if (clip.curator_note) {
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = clip.curator_note;
    wrap.appendChild(note);
  }
  const controls = document.createElement('div');
  controls.className = 'controls';
  const btn = document.createElement('button');
  btn.className = 'play';
  btn.textContent = 'Play';
  const audio = document.createElement('audio');
  audio.src = clip.audio || '';
  audio.preload = 'metadata';
  controls.appendChild(btn);
  controls.appendChild(audio);
  wrap.appendChild(controls);

  const tx = document.createElement('div');
  tx.className = 'transcript';
  const wordSpans = [];
  for (const word of (clip.words || [])) {
    const sp = document.createElement('span');
    sp.className = 'word';
    sp.textContent = word.text + ' ';
    sp.dataset.start = word.start_local;
    sp.dataset.end = word.end_local;
    tx.appendChild(sp);
    wordSpans.push(sp);
  }
  wrap.appendChild(tx);
  const src = document.createElement('div');
  src.className = 'source';
  src.textContent = `${clip.conversation_title} · ${clip.start_sec.toFixed(1)}s–${clip.end_sec.toFixed(1)}s`;
  wrap.appendChild(src);

  btn.addEventListener('click', () => {
    if (audio.paused) { audio.play(); btn.textContent = 'Pause'; }
    else { audio.pause(); btn.textContent = 'Play'; }
  });
  audio.addEventListener('ended', () => { btn.textContent = 'Play'; });
  audio.addEventListener('timeupdate', () => {
    const t = audio.currentTime;
    for (const span of wordSpans) {
      const s = parseFloat(span.dataset.start);
      const e = parseFloat(span.dataset.end);
      span.classList.toggle('active', t >= s && t <= e);
      span.classList.toggle('past', t > e);
    }
  });
  container.appendChild(wrap);
}

const root = document.getElementById('anthology');
for (const section of anthology.sections) {
  if (section.title) {
    const h = document.createElement('h2');
    h.textContent = section.title;
    root.appendChild(h);
  }
  if (section.intro) {
    const p = document.createElement('p');
    p.className = 'intro';
    p.textContent = section.intro;
    root.appendChild(p);
  }
  for (const clip of section.clips) { renderClip(root, clip); }
}
</script>
</body>
</html>
"""


def build_karaoke_zip(anth_id: int, embed_audio: bool = False) -> bytes:
    """Standalone HTML bundle with word-synced transcript."""
    anth = get_anthology(anth_id)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        manifest_sections = []
        with session() as s:
            for sec in anth["sections"]:
                manifest_clips = []
                for clip in sec["clips"]:
                    conv = s.get(Conversation, clip["conversation_id"])
                    if not conv:
                        continue
                    transcript = clip_transcript(
                        clip["conversation_id"],
                        clip["start_sec"],
                        clip["end_sec"],
                    )
                    # Re-base word timestamps to clip-local.
                    words_local = [
                        {
                            "text": w["text"],
                            "start_local": max(0.0, w["start_sec"] - clip["start_sec"]),
                            "end_local": max(0.0, w["end_sec"] - clip["start_sec"]),
                        }
                        for w in transcript["words"]
                    ]
                    audio_ref = ""
                    if conv.audio_path and Path(conv.audio_path).is_file():
                        wav_bytes = _cut_clip_wav(
                            conv.audio_path, clip["start_sec"], clip["end_sec"]
                        )
                        name = f"audio/{_clip_filename(clip['id'])}"
                        zf.writestr(name, wav_bytes)
                        audio_ref = name
                        if embed_audio:
                            import base64
                            b64 = base64.b64encode(wav_bytes).decode("ascii")
                            audio_ref = f"data:audio/wav;base64,{b64}"
                    manifest_clips.append({
                        "id": clip["id"],
                        "conversation_title": conv.title,
                        "curator_note": clip["curator_note"],
                        "start_sec": clip["start_sec"],
                        "end_sec": clip["end_sec"],
                        "audio": audio_ref,
                        "words": words_local,
                    })
                manifest_sections.append({
                    "title": sec["title"],
                    "intro": sec["intro"],
                    "clips": manifest_clips,
                })

        manifest = {
            "name": anth["name"],
            "preface": anth["preface"],
            "sections": manifest_sections,
        }

        preface_html = (
            f'<p class="preface">{_escape(anth["preface"])}</p>' if anth["preface"] else ""
        )
        html = (
            KARAOKE_HTML
            .replace("{title}", _escape(anth["name"]))
            .replace("{preface_html}", preface_html)
            .replace("{anthology_json}", json.dumps(manifest, ensure_ascii=False))
        )
        zf.writestr("index.html", html)
    return buf.getvalue()


def _escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
