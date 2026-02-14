from fastapi import Request

from app.services.document_ingestion import DocumentIngestionService
from app.services.container import ServiceContainer


def get_service_container(request: Request) -> ServiceContainer:
    return request.app.state.services


def get_document_ingestion_service(request: Request) -> DocumentIngestionService:
    return get_service_container(request).ingestion
