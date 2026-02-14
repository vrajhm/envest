from __future__ import annotations

from app.core.config import get_settings


class EmbeddingsService:
    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.embedding_model
        self.dimension = settings.embedding_dim
        self.configured = True
        self.last_error = ""

    async def embed_text(self, text: str) -> list[float]:
        # Deterministic lightweight embedding fallback for MVP recovery.
        base = sum(ord(c) for c in text) % 997
        return [((base + i) % 1000) / 1000.0 for i in range(self.dimension)]
