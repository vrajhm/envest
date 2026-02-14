from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["vector_backend"] in {"actian", "memory", "unknown"}
    assert payload["vector_db"] in {"connected", "not_connected", "not_initialized", "client_missing", "unreachable"}
    assert isinstance(payload["vector_client_installed"], bool)
    assert isinstance(payload["embedding_configured"], bool)
    assert isinstance(payload["embedding_model"], str)
    assert isinstance(payload["gemini_configured"], bool)
    assert isinstance(payload["gemini_model"], str)
    assert isinstance(payload["details"], dict)
