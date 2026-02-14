from fastapi import APIRouter

from app.models.schemas import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    # TODO: retrieve context from vector db + generate response + persist turn.
    return ChatResponse(
        answer=(
            "RAG pipeline not wired yet. Next step: embed query, search filtered chunks, "
            "build grounded prompt, then generate/cite answer."
        ),
        citations=[],
        confidence_0_100=0,
    )
