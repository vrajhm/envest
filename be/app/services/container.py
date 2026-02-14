from dataclasses import dataclass

from app.services.document_ingestion import DocumentIngestionService
from app.services.embeddings import EmbeddingsService
from app.services.parser import ParserService
from app.services.vector_store import VectorStoreService


@dataclass
class ServiceContainer:
    parser: ParserService
    embeddings: EmbeddingsService
    vector_store: VectorStoreService
    ingestion: DocumentIngestionService


def build_services() -> ServiceContainer:
    parser = ParserService()
    embeddings = EmbeddingsService()
    vector_store = VectorStoreService()
    ingestion = DocumentIngestionService(
        parser=parser,
        embeddings=embeddings,
        vector_store=vector_store,
    )
    return ServiceContainer(
        parser=parser,
        embeddings=embeddings,
        vector_store=vector_store,
        ingestion=ingestion,
    )
