from hashlib import sha256

from app.core.config import get_settings


class EmbeddingsService:
    def __init__(self) -> None:
        self._settings = get_settings()

    async def embed_text(self, text: str) -> list[float]:
        # MVP deterministic embedding placeholder. Replace with real provider.
        dim = self._settings.embedding_dimension
        values: list[float] = []
        seed = text.encode("utf-8")
        while len(values) < dim:
            seed = sha256(seed).digest()
            for b in seed:
                # map 0..255 -> -1..1
                values.append((b / 127.5) - 1.0)
                if len(values) == dim:
                    break
        return values
