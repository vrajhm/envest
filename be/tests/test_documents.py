from fastapi.testclient import TestClient

from app.api.dependencies import get_document_ingestion_service
from app.main import app
from app.services.document_ingestion import IngestionResult


class FakeIngestionService:
    async def ingest_document(self, file_path: str, tenant_id: str, user_id: str, document_id: str | None = None) -> IngestionResult:
        return IngestionResult(document_id="doc-test-123", chunk_count=3, char_count=1200)


def test_upload_document_endpoint() -> None:
    app.dependency_overrides[get_document_ingestion_service] = lambda: FakeIngestionService()
    client = TestClient(app)

    response = client.post(
        "/v1/documents/upload",
        data={"tenant_id": "t1", "user_id": "u1"},
        files={"file": ("contract.txt", b"sample climate contract text")},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["document_id"] == "doc-test-123"
    assert payload["status"] == "indexed"
    assert payload["chunk_count"] == 3
