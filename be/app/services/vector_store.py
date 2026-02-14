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

        self.document_chunks_collection = self._settings.vector_collection_document_chunks
        self.nitpick_issues_collection = self._settings.vector_collection_nitpick_issues
        self.conversation_turns_collection = self._settings.vector_collection_conversation_turns
        self.review_sessions_collection = self._settings.vector_collection_review_sessions

    async def connect(self) -> None:
        if self._connected:
            return
        if AsyncCortexClient is None:
            logger.warning("cortex client not installed yet; vector operations will fail until wheel is installed")
            return
        self._client = AsyncCortexClient(self._settings.vector_db_address)
        await self._client.connect()
        self._connected = True

    async def close(self) -> None:
        if self._client and self._connected:
            await self._client.close()
        self._connected = False

    async def ensure_collections(self) -> None:
        client = await self._require_client()
        names = [
            self.document_chunks_collection,
            self.nitpick_issues_collection,
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

    async def upsert_review_session(self, session_id: str, vector: list[float], payload: dict[str, Any]) -> None:
        client = await self._require_client()
        await client.upsert(self.review_sessions_collection, self._point_id(f"session:{session_id}"), vector, payload)

    async def get_review_session(self, session_id: str) -> dict[str, Any] | None:
        client = await self._require_client()
        try:
            record = await client.get(self.review_sessions_collection, self._point_id(f"session:{session_id}"))
        except Exception as exc:  # pragma: no cover - depends on server behavior
            if "not found" in str(exc).lower():
                return None
            raise
        if record is None:
            return None
        return getattr(record, "payload", None)

    async def batch_upsert_document_chunks(
        self,
        session_id: str,
        chunk_ids: list[str],
        vectors: list[list[float]],
        payloads: list[dict[str, Any]],
    ) -> None:
        client = await self._require_client()
        ids = [self._point_id(f"chunk:{session_id}:{cid}") for cid in chunk_ids]
        await client.batch_upsert(self.document_chunks_collection, ids=ids, vectors=vectors, payloads=payloads)

    async def batch_upsert_nitpick_issues(
        self,
        session_id: str,
        issue_ids: list[str],
        vectors: list[list[float]],
        payloads: list[dict[str, Any]],
    ) -> None:
        client = await self._require_client()
        ids = [self._point_id(f"issue:{session_id}:{iid}") for iid in issue_ids]
        await client.batch_upsert(self.nitpick_issues_collection, ids=ids, vectors=vectors, payloads=payloads)

    async def upsert_nitpick_issue(
        self,
        session_id: str,
        issue_id: str,
        vector: list[float],
        payload: dict[str, Any],
    ) -> None:
        client = await self._require_client()
        await client.upsert(
            self.nitpick_issues_collection,
            self._point_id(f"issue:{session_id}:{issue_id}"),
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
        client = await self._require_client()
        await client.upsert(
            self.conversation_turns_collection,
            self._point_id(f"turn:{session_id}:{turn_id}"),
            vector,
            payload,
        )

    async def _require_client(self) -> Any:
        if not self._connected:
            await self.connect()
        if self._client is None:
            raise RuntimeError(
                "Vector client unavailable. Install Actian wheel and ensure VECTOR_DB_ADDRESS is reachable."
            )
        return self._client

    @staticmethod
    def _point_id(raw: str) -> int:
        digest = sha256(raw.encode("utf-8")).digest()
        return int.from_bytes(digest[:8], "big") & ((1 << 63) - 1)
