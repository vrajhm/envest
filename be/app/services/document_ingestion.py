from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from app.core.config import get_settings
from app.services.embeddings import EmbeddingsService
from app.services.parser import ParserService
from app.services.vector_store import VectorStoreService


@dataclass
class IngestionResult:
    document_id: str
    chunk_count: int
    char_count: int


class DocumentIngestionService:
    def __init__(
        self,
        parser: ParserService,
        embeddings: EmbeddingsService,
        vector_store: VectorStoreService,
    ) -> None:
        self._parser = parser
        self._embeddings = embeddings
        self._vector_store = vector_store
        self._settings = get_settings()

    async def ingest_document(
        self,
        file_path: str,
        tenant_id: str,
        user_id: str,
        document_id: str | None = None,
    ) -> IngestionResult:
        text = await self._parser.parse_document(file_path)
        chunks = self._chunk_text(text)
        if not chunks:
            raise ValueError("No chunks produced from parsed document.")

        vectors = [await self._embeddings.embed_text(chunk) for chunk in chunks]
        doc_id = document_id or self._build_document_id(Path(file_path).stem)
        indexed_count = await self._vector_store.upsert_document_chunks(
            document_id=doc_id,
            chunks=chunks,
            vectors=vectors,
            tenant_id=tenant_id,
            user_id=user_id,
        )
        return IngestionResult(
            document_id=doc_id,
            chunk_count=indexed_count,
            char_count=len(text),
        )

    def _chunk_text(self, text: str) -> list[str]:
        size = self._settings.chunk_size_chars
        overlap = self._settings.chunk_overlap_chars
        if size <= 0:
            raise ValueError("chunk_size_chars must be > 0")
        if overlap < 0 or overlap >= size:
            raise ValueError("chunk_overlap_chars must be >= 0 and < chunk_size_chars")

        chunks: list[str] = []
        start = 0
        step = size - overlap
        while start < len(text):
            end = min(start + size, len(text))
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            start += step
        return chunks

    @staticmethod
    def _build_document_id(stem: str) -> str:
        cleaned = "".join(ch if ch.isalnum() else "-" for ch in stem.lower()).strip("-")
        return f"{cleaned or 'doc'}-{uuid4().hex[:8]}"
