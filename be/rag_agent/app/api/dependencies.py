from fastapi import Request

from app.services.chat_service import ChatService
from app.services.cleanup_service import CleanupService
from app.services.container import ServiceContainer
from app.services.session_service import SessionService


def get_container(request: Request) -> ServiceContainer:
    return request.app.state.services


def get_session_service(request: Request) -> SessionService:
    return get_container(request).session_service


def get_chat_service(request: Request) -> ChatService:
    return get_container(request).chat_service


def get_cleanup_service(request: Request) -> CleanupService:
    return get_container(request).cleanup_service
