from app.models.schemas import ChatResponse


class RAGService:
    async def answer_question(
        self,
        tenant_id: str,
        doc_id: str,
        conversation_id: str,
        question: str,
        top_k: int,
    ) -> ChatResponse:
        # TODO: implement retrieval, prompt assembly, generation, citations, scoring.
        return ChatResponse(
            answer="Stub answer. Implement retrieval + generation in RAGService.",
            citations=[],
            confidence_0_100=0,
        )
