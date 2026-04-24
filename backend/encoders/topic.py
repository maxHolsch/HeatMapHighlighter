"""
Topical text embedder (sentence-transformers/all-MiniLM-L6-v2 by default).

Lazy singleton: the first call to `embed(...)` loads the model. Pure text
embeddings mean this path never requires audio or GPU.
"""

from __future__ import annotations

from typing import List, Optional

import numpy as np

from config import TOPIC_MODEL

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer  # local import: heavy
        _model = SentenceTransformer(TOPIC_MODEL)
    return _model


def embed(texts: List[str], batch_size: int = 32) -> np.ndarray:
    """Return an (N, D) float32 numpy array of L2-normalized topic embeddings."""
    if not texts:
        from config import TOPIC_EMBED_DIM
        return np.zeros((0, TOPIC_EMBED_DIM), dtype=np.float32)
    model = _get_model()
    vecs = model.encode(
        texts,
        batch_size=batch_size,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return vecs.astype(np.float32)


def embed_one(text: str) -> np.ndarray:
    return embed([text])[0]
