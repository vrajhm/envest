from __future__ import annotations

import logging

from app.core.config import get_settings

try:
    from google import genai
except ImportError:  # pragma: no cover
    genai = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


class GeminiService:
    def __init__(self) -> None:
        settings = get_settings()
        self._model = settings.gemini_model
        self._api_key = settings.gemini_api_key.strip()
        self._last_error: str | None = None

        self._client = None
        if genai is None:
            self._last_error = "google-genai package not installed"
            logger.warning("google-genai is not installed; falling back to local responses")
            return
        if not self._api_key:
            self._last_error = "GEMINI_API_KEY is not configured"
            logger.warning("GEMINI_API_KEY not configured; falling back to local responses")
            return
        self._client = genai.Client(api_key=self._api_key)
        self._last_error = None

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        if self._client is None:
            return self._fallback_response()

        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=f"{system_prompt}\n\n{user_prompt}",
            )
            text = (getattr(response, "text", None) or "").strip()
            if text:
                self._last_error = None
                return text
            return self._fallback_response()
        except Exception as exc:  # pragma: no cover - network/provider failure
            self._last_error = str(exc)
            logger.warning("Gemini generation failed: %s", exc)
            return self._fallback_response()

    @staticmethod
    def _fallback_response() -> str:
        return (
            "I captured your feedback and updated the issue workflow state. "
            "I can suggest precise contract language once Gemini is configured."
        )

    @property
    def configured(self) -> bool:
        return self._client is not None

    @property
    def model(self) -> str:
        return self._model

    @property
    def last_error(self) -> str | None:
        return self._last_error
