from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.api.dependencies import get_document_ingestion_service
from app.core.config import get_settings
from app.models.schemas import UploadDocumentResponse
from app.services.document_ingestion import DocumentIngestionService

router = APIRouter()


@router.post("/upload", response_model=UploadDocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    tenant_id: str = Form(default="dev-tenant"),
    user_id: str = Form(default="dev-user"),
    ingestion_service: DocumentIngestionService = Depends(get_document_ingestion_service),
) -> UploadDocumentResponse:
    settings = get_settings()
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(file.filename or "upload.txt").name
    local_path = upload_dir / f"{uuid4().hex[:12]}-{safe_name}"
    data = await file.read()
    local_path.write_bytes(data)

    try:
        result = await ingestion_service.ingest_document(
            file_path=str(local_path),
            tenant_id=tenant_id,
            user_id=user_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Document ingest failed: {exc}") from exc

    return UploadDocumentResponse(
        document_id=result.document_id,
        filename=safe_name,
        status="indexed",
        chunk_count=result.chunk_count,
        char_count=result.char_count,
    )
