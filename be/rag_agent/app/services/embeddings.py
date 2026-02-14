from __future__ import annotations

from hashlib import sha256
import logging

from app.core.config import get_settings

try:
    from google import genai
except ImportError:  # pragma: no cover
    genai = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


class EmbeddingsService:
    def __init__(self) -> None:
        settings = get_settings()
        self._dim = settings.embedding_dim
        self._model = settings.embedding_model
        self._api_key = settings.gemini_api_key.strip()
        self._client = None
        self._last_error: str | None = None

        if genai is None:
            self._last_error = "google-genai package not installed; deterministic fallback active"
            logger.warning(self._last_error)
            return
        if not self._api_key:
            self._last_error = "GEMINI_API_KEY not configured; deterministic embedding fallback active"
            logger.warning(self._last_error)
            return

        self._client = genai.Client(api_key=self._api_key)
        self._last_error = None

    async def embed_text(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
        if self._client is None:
            return self._deterministic_fallback(text)

        try:
            response = self._client.models.embed_content(
                model=self._model,
                contents=text,
                config={
                    "taskType": task_type,
                    "outputDimensionality": self._dim,
                },
            )
            embeddings = getattr(response, "embeddings", None) or []
            if not embeddings or not getattr(embeddings[0], "values", None):
                self._last_error = "Embedding response was empty; fallback active"
                logger.warning(self._last_error)
                return self._deterministic_fallback(text)

            values = list(embeddings[0].values)
            if len(values) > self._dim:
                values = values[: self._dim]
            elif len(values) < self._dim:
                values.extend([0.0] * (self._dim - len(values)))

            self._last_error = None
            return values
        except Exception as exc:  # pragma: no cover - network/provider failure
            self._last_error = str(exc)
            logger.warning("Embedding call failed: %s; deterministic fallback active", exc)
            return self._deterministic_fallback(text)

    def _deterministic_fallback(self, text: str) -> list[float]:
        """Deterministic fallback to keep API functional when provider is unavailable."""
        seed = text.encode("utf-8")
        values: list[float] = []
        while len(values) < self._dim:
            seed = sha256(seed).digest()
            for b in seed:
                values.append((b / 127.5) - 1.0)
                if len(values) == self._dim:
                    break
        return values

    @property
    def configured(self) -> bool:
        return self._client is not None

    @property
    def model(self) -> str:
        return self._model

    @property
    def last_error(self) -> str | None:
        return self._last_error
