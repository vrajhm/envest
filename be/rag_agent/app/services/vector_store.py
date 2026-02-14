from __future__ import annotations

from typing import Any

from app.core.config import get_settings


class VectorStoreService:
    def __init__(self) -> None:
        settings = get_settings()
        self._backend = settings.vector_backend.lower().strip()
        self._connected = False
        self._last_error = ""
        self._sessions: dict[str, dict[str, Any]] = {}

    async def connect(self) -> None:
        # MVP recovery: memory backend is the stable mode.
        if self._backend != "memory":
            self._last_error = "actian_unavailable_in_recovery_mode"
            if get_settings().vector_auto_fallback_memory:
                self._backend = "memory"
            else:
                self._connected = False
                return
        self._connected = True
        self._last_error = ""

    async def close(self) -> None:
        self._connected = False

    async def ensure_collections(self) -> None:
        return

    async def ping(self) -> tuple[bool, str]:
        if self._backend == "memory":
            return True, "ok:memory"
        return False, "unreachable"

    async def upsert_review_session(self, session_id: str, payload: dict[str, Any]) -> None:
        self._sessions[session_id] = payload

    async def get_review_session(self, session_id: str) -> dict[str, Any] | None:
        return self._sessions.get(session_id)

    @property
    def backend(self) -> str:
        return self._backend

    @property
    def connected(self) -> bool:
        return self._connected

    @property
    def last_error(self) -> str:
        return self._last_error

    @property
    def client_installed(self) -> bool:
        return True
