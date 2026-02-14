from hashlib import sha256
from typing import Any

try:
    from cortex import AsyncCortexClient
except ImportError:  # pragma: no cover
    AsyncCortexClient = None  # type: ignore[assignment]

from app.core.config import get_settings


class VectorStoreService:
    def __init__(self) -> None:
        settings = get_settings()
        self._doc_collection = settings.vector_doc_collection
        self._turn_collection = settings.vector_turn_collection
        self._dimension = settings.embedding_dimension
        if AsyncCortexClient is None:
            self._client: Any = None
        else:
            self._client = AsyncCortexClient(settings.vector_db_address)
        self._connected = False
        self._collections_ready = False

    async def _ensure_ready(self) -> None:
        if self._client is None:
            raise RuntimeError(
                "Actian Cortex client is not installed. Install the wheel: "
                "pip install ./actiancortex-0.1.0b1-py3-none-any.whl"
            )
        if not self._connected:
            await self._client.connect()
            self._connected = True
        if not self._collections_ready:
            await self.ensure_collections()
            self._collections_ready = True

    async def connect(self) -> None:
        await self._ensure_ready()

    async def close(self) -> None:
        if self._connected:
            await self._client.close()
        self._connected = False
        self._collections_ready = False

    async def ensure_collections(self) -> None:
        for name in [self._doc_collection, self._turn_collection]:
            if not await self._client.has_collection(name):
                await self._client.create_collection(name=name, dimension=self._dimension)

    async def health_check(self) -> tuple[str, int]:
        await self._ensure_ready()
        return await self._client.health_check()

    async def search_document_chunks(
        self,
        query_vector: list[float],
        top_k: int,
    ):
        await self._ensure_ready()
        return await self._client.search(self._doc_collection, query_vector, top_k=top_k)

    async def upsert_document_chunks(
        self,
        document_id: str,
        chunks: list[str],
        vectors: list[list[float]],
        tenant_id: str,
        user_id: str,
    ) -> int:
        await self._ensure_ready()
        ids = [self._chunk_point_id(document_id, i) for i in range(len(chunks))]
        payloads = [
            {
                "doc_id": document_id,
                "chunk_id": f"{document_id}:{i}",
                "text": text,
                "tenant_id": tenant_id,
                "user_id": user_id,
            }
            for i, text in enumerate(chunks)
        ]
        await self._client.batch_upsert(
            self._doc_collection,
            ids=ids,
            vectors=vectors,
            payloads=payloads,
        )
        return len(ids)

    @staticmethod
    def _chunk_point_id(document_id: str, chunk_index: int) -> int:
        raw = f"{document_id}:{chunk_index}".encode("utf-8")
        digest = sha256(raw).digest()
        # Keep it positive and under signed 63-bit range.
        return int.from_bytes(digest[:8], "big") & ((1 << 63) - 1)
