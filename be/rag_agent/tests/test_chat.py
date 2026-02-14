from fastapi.testclient import TestClient

from app.api.dependencies import get_chat_service
from app.main import app
from app.models.schemas import ChatResponse, ClauseStatusUpdate


class FakeChatService:
    async def chat(self, session_id: str, request):  # noqa: ANN001
        return ChatResponse(
            answer="Acknowledged. I marked this clause in progress and captured your edit request.",
            citations=["clause_001"],
            inferred_updates=[
                ClauseStatusUpdate(
                    clause_id=request.clause_id or "clause_001",
                    previous_status="open",
                    new_status="in_progress",
                    reason="Investor requested edits.",
                )
            ],
            pending_resolution_clause_id=request.clause_id or "clause_001",
        )


def test_chat_endpoint() -> None:
    app.dependency_overrides[get_chat_service] = lambda: FakeChatService()
    client = TestClient(app)

    response = client.post(
        "/v1/reviews/sessions/sess_001/chat",
        json={
            "conversation_id": "conv_001",
            "clause_id": "clause_001",
            "message": "Please add stricter annual reporting language for this clause.",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["citations"] == ["clause_001"]
    assert payload["inferred_updates"][0]["new_status"] == "in_progress"
    assert payload["pending_resolution_clause_id"] == "clause_001"
