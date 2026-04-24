"""
Audio preparation: load any common format, convert to 16 kHz mono float32,
write a cached WAV, and provide per-snippet sample slicing.
"""

from __future__ import annotations

from pathlib import Path
from typing import Tuple

import numpy as np

TARGET_SR = 16_000


def load_mono_16k(src_path: str) -> np.ndarray:
    """Return a 1-D float32 numpy array resampled to 16 kHz mono."""
    import librosa  # local: heavy
    audio, _sr = librosa.load(src_path, sr=TARGET_SR, mono=True)
    return np.asarray(audio, dtype=np.float32)


def write_wav_16k(samples: np.ndarray, dest: Path) -> None:
    import soundfile as sf  # local: heavy
    dest.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(dest), samples, TARGET_SR, subtype="PCM_16")


def slice_samples(samples: np.ndarray, start_sec: float, end_sec: float) -> np.ndarray:
    start = max(0, int(start_sec * TARGET_SR))
    end = min(len(samples), int(end_sec * TARGET_SR))
    if end <= start:
        return np.zeros(1, dtype=np.float32)
    return samples[start:end]


def duration_sec(samples: np.ndarray) -> float:
    return len(samples) / TARGET_SR
