"""
Wonjune Kang's expressive speech retrieval encoders, wrapped for this app.

- `embed_audio([samples_a, samples_b, ...])` -> (N, 512) numpy
- `embed_text_query("frustrated tone")` -> (512,) numpy

Loads Wonjune's sibling repo (`expressive-speech-retrieval/`) by adding it
to sys.path. Hard-fails with a clear message if the checkpoint path is not
set or points at a missing file, so any audio-scoped feature that calls
this module surfaces a good error rather than silently stubbing.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import List, Optional

import numpy as np

from config import (
    STYLE_EMBED_DIM,
    WONJUNE_CHECKPOINT_PATH,
    WONJUNE_CONFIG,
    WONJUNE_DEVICE,
    WONJUNE_REPO_DIR,
)

_SPEECH_ENC = None
_TEXT_ENC = None
_TOKENIZER = None
_TORCH = None
_CONFIG = None


def is_available() -> bool:
    """True iff the checkpoint file exists on disk."""
    return bool(WONJUNE_CHECKPOINT_PATH) and Path(WONJUNE_CHECKPOINT_PATH).is_file()


def _require_available() -> None:
    if not WONJUNE_CHECKPOINT_PATH:
        raise RuntimeError(
            "WONJUNE_CHECKPOINT_PATH is not set. Audio-scoped features "
            "(style embedding, style retrieval) are disabled until a "
            "Wonjune checkpoint is provided."
        )
    if not Path(WONJUNE_CHECKPOINT_PATH).is_file():
        raise RuntimeError(
            f"Wonjune checkpoint not found at {WONJUNE_CHECKPOINT_PATH}. "
            "Download the roberta_emotion2vec checkpoint from the Google "
            "Drive link in expressive-speech-retrieval/README.md."
        )
    if not WONJUNE_REPO_DIR.is_dir():
        raise RuntimeError(
            f"expressive-speech-retrieval repo not found at {WONJUNE_REPO_DIR}. "
            "Set WONJUNE_REPO_DIR to its path."
        )


def _ensure_path() -> None:
    """Add Wonjune's repo to sys.path so its `model.*` and `utils` resolve."""
    repo = str(WONJUNE_REPO_DIR)
    if repo not in sys.path:
        sys.path.insert(0, repo)


def _load() -> None:
    global _SPEECH_ENC, _TEXT_ENC, _TOKENIZER, _TORCH, _CONFIG
    if _SPEECH_ENC is not None:
        return
    _require_available()
    _ensure_path()

    import torch  # local import: heavy
    from omegaconf import OmegaConf
    from transformers import AutoTokenizer

    # Imports from Wonjune's repo.
    from model.speech_style_encoder import SpeechStyleEncoder  # type: ignore
    from model.style_prompt_encoder import StylePromptEncoder  # type: ignore

    config_path = WONJUNE_REPO_DIR / WONJUNE_CONFIG
    if not config_path.is_file():
        raise RuntimeError(f"Wonjune config not found at {config_path}")
    cfg = OmegaConf.load(str(config_path))

    device = torch.device(WONJUNE_DEVICE)
    speech_enc = SpeechStyleEncoder(config=cfg, device=device)
    text_enc = StylePromptEncoder(config=cfg, device=device)

    ckpt = torch.load(WONJUNE_CHECKPOINT_PATH, map_location=device)
    speech_enc.load_state_dict(ckpt["speech_style_encoder"])
    text_enc.load_state_dict(ckpt["style_prompt_encoder"])
    speech_enc.eval().to(device)
    text_enc.eval().to(device)

    tokenizer = AutoTokenizer.from_pretrained(cfg.model.style_prompt_encoder.type)

    _SPEECH_ENC = speech_enc
    _TEXT_ENC = text_enc
    _TOKENIZER = tokenizer
    _TORCH = torch
    _CONFIG = cfg


def embed_audio(audio_arrays: List[np.ndarray]) -> np.ndarray:
    """
    Batched speech-style embedding.

    Each element of `audio_arrays` is a mono 16 kHz float32 waveform.
    Returns an (N, 512) float32 numpy array. Batch pads to the longest clip.
    """
    if not audio_arrays:
        return np.zeros((0, STYLE_EMBED_DIM), dtype=np.float32)

    _load()
    torch = _TORCH

    out_rows = []
    with torch.no_grad():
        for arr in audio_arrays:
            arr = np.asarray(arr, dtype=np.float32)
            if arr.ndim != 1:
                arr = arr.reshape(-1)
            t = torch.from_numpy(arr).unsqueeze(0).to(WONJUNE_DEVICE)
            emb = _SPEECH_ENC(t).detach().squeeze(0).cpu().numpy().astype(np.float32)
            out_rows.append(emb)
    return np.stack(out_rows, axis=0)


def embed_text_query(query: str) -> np.ndarray:
    """Encode a natural-language style prompt to a (512,) float32 vector."""
    _load()
    torch = _TORCH
    tok = _TOKENIZER(query, padding=True, return_tensors="pt")
    input_ids = tok["input_ids"].to(WONJUNE_DEVICE)
    attn = tok["attention_mask"].to(WONJUNE_DEVICE)
    with torch.no_grad():
        emb = _TEXT_ENC(input_ids=input_ids, attention_mask=attn)
    return emb.detach().squeeze(0).cpu().numpy().astype(np.float32)
