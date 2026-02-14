from dataclasses import dataclass

from app.services.chat_service import ChatService
from app.services.cleanup_service import CleanupService
from app.services.embeddings import EmbeddingsService
from app.services.gemini_service import GeminiService
from app.services.session_service import SessionService
from app.services.vector_store import VectorStoreService


@dataclass
class ServiceContainer:
    embeddings: EmbeddingsService
    vector_store: VectorStoreService
    session_service: SessionService
    gemini_service: GeminiService
    chat_service: ChatService
    cleanup_service: CleanupService


def build_services() -> ServiceContainer:
    vector_store = VectorStoreService()
    embeddings = EmbeddingsService()
    session_service = SessionService(vector_store=vector_store)
    gemini_service = GeminiService()
    chat_service = ChatService(session_service=session_service, gemini=gemini_service)
    cleanup_service = CleanupService(session_service=session_service, gemini=gemini_service)
    return ServiceContainer(
        embeddings=embeddings,
        vector_store=vector_store,
        session_service=session_service,
        gemini_service=gemini_service,
        chat_service=chat_service,
        cleanup_service=cleanup_service,
    )
