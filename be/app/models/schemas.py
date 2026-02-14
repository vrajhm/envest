from pydantic import BaseModel, Field


class UploadDocumentResponse(BaseModel):
    document_id: str
    filename: str
    status: str
    chunk_count: int = 0
    char_count: int = 0
    message: str | None = None


class ChatRequest(BaseModel):
    tenant_id: str
    user_id: str
    doc_id: str
    conversation_id: str
    question: str = Field(min_length=3)
    top_k: int = Field(default=8, ge=1, le=30)


class Citation(BaseModel):
    chunk_id: str
    quote: str | None = None


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    confidence_0_100: int = Field(ge=0, le=100)
