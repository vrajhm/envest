from __future__ import annotations

import logging
from hashlib import sha256
from typing import Any

from app.core.config import get_settings

try:
    from cortex import AsyncCortexClient
except ImportError:  # pragma: no cover
    AsyncCortexClient = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


class VectorStoreService:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._client: Any | None = None
        self._connected = False
        self._last_error: str | None = None
        self._backend = self._settings.vector_backend.lower().strip()
        if self._backend not in {"actian", "memory"}:
            raise ValueError("VECTOR_BACKEND must be either 'actian' or 'memory'")

        self.per_goal_scores_collection = self._settings.vector_collection_per_goal_scores
        self.vulnerable_clauses_collection = self._settings.vector_collection_vulnerable_clauses
        self.conversation_turns_collection = self._settings.vector_collection_conversation_turns
        self.review_sessions_collection = self._settings.vector_collection_review_sessions

        self._mem_review_sessions: dict[str, dict[str, Any]] = {}
        self._mem_per_goal_scores: dict[tuple[str, str], dict[str, Any]] = {}
        self._mem_vulnerable_clauses: dict[tuple[str, str], dict[str, Any]] = {}
        self._mem_conversation_turns: dict[tuple[str, str], dict[str, Any]] = {}

    async def connect(self) -> None:
        if self._connected:
            return
        if self._backend == "memory":
            self._connected = True
            self._last_error = None
            return
        if AsyncCortexClient is None:
            self._last_error = (
                "Actian cortex client not installed. Install wheel: "
                "pip install ./actiancortex-0.1.0b1-py3-none-any.whl"
            )
            if self._settings.vector_auto_fallback_memory:
                self._activate_memory_fallback(self._last_error)
                return
            logger.warning("cortex client not installed yet; vector operations will fail until wheel is installed")
            return
        try:
            self._client = AsyncCortexClient(self._settings.vector_db_address)
            await self._client.connect()
            self._connected = True
            self._last_error = None
        except Exception as exc:
            self._connected = False
            self._last_error = str(exc)
            if self._settings.vector_auto_fallback_memory:
                self._activate_memory_fallback(self._last_error)
                return
            raise

    async def close(self) -> None:
        if self._backend == "memory":
            self._connected = False
            return
        if self._client and self._connected:
            await self._client.close()
        self._connected = False

    async def ensure_collections(self) -> None:
        if self._backend == "memory":
            return
        client = await self._require_client()
        names = [
            self.per_goal_scores_collection,
            self.vulnerable_clauses_collection,
            self.conversation_turns_collection,
            self.review_sessions_collection,
        ]
        for name in names:
            if not await client.has_collection(name):
                await client.create_collection(
                    name=name,
                    dimension=self._settings.embedding_dim,
                    distance_metric=self._settings.vector_distance_metric,
                    hnsw_m=self._settings.vector_hnsw_m,
                    hnsw_ef_construct=self._settings.vector_hnsw_ef_construct,
                    hnsw_ef_search=self._settings.vector_hnsw_ef_search,
                )
        self._last_error = None

    async def upsert_review_session(self, session_id: str, vector: list[float], payload: dict[str, Any]) -> None:
        if self._backend == "memory":
            self._mem_review_sessions[session_id] = payload
            return
        client = await self._require_client()
        await client.upsert(self.review_sessions_collection, self._point_id(f"session:{session_id}"), vector, payload)

    async def get_review_session(self, session_id: str) -> dict[str, Any] | None:
        if self._backend == "memory":
            return self._mem_review_sessions.get(session_id)
        client = await self._require_client()
        try:
            record = await client.get(self.review_sessions_collection, self._point_id(f"session:{session_id}"))
        except Exception as exc:  # pragma: no cover
            if "not found" in str(exc).lower():
                return None
            raise
        if record is None:
            return None
        return getattr(record, "payload", None)

    async def batch_upsert_per_goal_scores(
        self,
        session_id: str,
        goal_ids: list[str],
        vectors: list[list[float]],
        payloads: list[dict[str, Any]],
    ) -> None:
        if self._backend == "memory":
            for goal_id, payload in zip(goal_ids, payloads, strict=True):
                self._mem_per_goal_scores[(session_id, goal_id)] = payload
            return
        client = await self._require_client()
        ids = [self._point_id(f"goal:{session_id}:{gid}") for gid in goal_ids]
        await client.batch_upsert(self.per_goal_scores_collection, ids=ids, vectors=vectors, payloads=payloads)

    async def batch_upsert_vulnerable_clauses(
        self,
        session_id: str,
        clause_ids: list[str],
        vectors: list[list[float]],
        payloads: list[dict[str, Any]],
    ) -> None:
        if self._backend == "memory":
            for clause_id, payload in zip(clause_ids, payloads, strict=True):
                self._mem_vulnerable_clauses[(session_id, clause_id)] = payload
            return
        client = await self._require_client()
        ids = [self._point_id(f"clause:{session_id}:{cid}") for cid in clause_ids]
        await client.batch_upsert(self.vulnerable_clauses_collection, ids=ids, vectors=vectors, payloads=payloads)

    async def upsert_vulnerable_clause(
        self,
        session_id: str,
        clause_id: str,
        vector: list[float],
        payload: dict[str, Any],
    ) -> None:
        if self._backend == "memory":
            self._mem_vulnerable_clauses[(session_id, clause_id)] = payload
            return
        client = await self._require_client()
        await client.upsert(
            self.vulnerable_clauses_collection,
            self._point_id(f"clause:{session_id}:{clause_id}"),
            vector,
            payload,
        )

    async def upsert_conversation_turn(
        self,
        session_id: str,
        turn_id: str,
        vector: list[float],
        payload: dict[str, Any],
    ) -> None:
        if self._backend == "memory":
            self._mem_conversation_turns[(session_id, turn_id)] = payload
            return
        client = await self._require_client()
        await client.upsert(
            self.conversation_turns_collection,
            self._point_id(f"turn:{session_id}:{turn_id}"),
            vector,
            payload,
        )

    async def _require_client(self) -> Any:
        if self._backend == "memory":
            raise RuntimeError("No external vector client in memory mode.")
        if not self._connected:
            await self.connect()
        if self._client is None:
            self._last_error = (
                "Vector client unavailable. Install Actian wheel and ensure VECTOR_DB_ADDRESS is reachable."
            )
            raise RuntimeError(
                "Vector client unavailable. Install Actian wheel and ensure VECTOR_DB_ADDRESS is reachable."
            )
        return self._client

    async def ping(self) -> tuple[bool, str]:
        if self._backend == "memory":
            return True, "ok:memory"
        if AsyncCortexClient is None:
            return False, "client_missing"
        try:
            client = await self._require_client()
            version, uptime = await client.health_check()
            self._last_error = None
            return True, f"ok:{version}:{uptime}"
        except Exception as exc:
            self._last_error = str(exc)
            return False, "unreachable"

    @property
    def client_installed(self) -> bool:
        if self._backend == "memory":
            return True
        return AsyncCortexClient is not None

    @property
    def connected(self) -> bool:
        return self._connected

    @property
    def backend(self) -> str:
        return self._backend

    @property
    def last_error(self) -> str | None:
        return self._last_error

    @staticmethod
    def _point_id(raw: str) -> int:
        digest = sha256(raw.encode("utf-8")).digest()
        return int.from_bytes(digest[:8], "big") & ((1 << 63) - 1)

    def _activate_memory_fallback(self, reason: str) -> None:
        logger.warning("Switching VectorStore backend from actian to memory fallback (%s)", reason)
        self._backend = "memory"
        self._connected = True
