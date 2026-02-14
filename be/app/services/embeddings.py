from hashlib import sha256

from app.core.config import get_settings


class EmbeddingsService:
    def __init__(self) -> None:
        self._dim = get_settings().embedding_dim

    async def embed_text(self, text: str) -> list[float]:
        # Deterministic placeholder embedding for MVP plumbing.
        seed = text.encode("utf-8")
        values: list[float] = []
        while len(values) < self._dim:
            seed = sha256(seed).digest()
            for b in seed:
                values.append((b / 127.5) - 1.0)
                if len(values) == self._dim:
                    break
        return values
