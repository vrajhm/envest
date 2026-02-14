from __future__ import annotations

from app.core.config import get_settings

try:
    import google.generativeai as genai
except Exception:  # pragma: no cover
    genai = None


class GeminiService:
    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.gemini_model
        self.api_key = settings.gemini_api_key
        self.configured = bool(self.api_key and genai is not None)
        self.last_error = ""
        if self.configured:
            try:
                genai.configure(api_key=self.api_key)
                self._client = genai.GenerativeModel(self.model)
            except Exception as exc:  # pragma: no cover
                self.configured = False
                self.last_error = str(exc)
                self._client = None
        else:
            self._client = None

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        if self.configured and self._client is not None:
            try:
                out = self._client.generate_content(f"{system_prompt}\n\n{user_prompt}")
                text = (out.text or "").strip()
                if text:
                    return text
            except Exception as exc:  # pragma: no cover
                self.last_error = str(exc)
        return (
            "Suggested next edits based on current clause context: "
            "tighten ambiguous language, add measurable deadlines, and clarify enforcement terms."
        )
