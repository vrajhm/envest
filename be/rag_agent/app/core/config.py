from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Envest RAG API"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    vector_backend: str = "memory"
    vector_auto_fallback_memory: bool = True
    vector_db_address: str = "localhost:50051"

    embedding_dim: int = 768
    embedding_model: str = "models/gemini-embedding-001"

    gemini_model: str = "models/gemini-3-flash-preview"
    gemini_api_key: str = ""
    openaq_api_key: str = ""

    artifacts_dir: str = "be/rag_agent/artifacts"
    parsing_retrieve_url: str = "http://127.0.0.1:8000/retrieve"
    chat_retrieval_top_k: int = 3
    chat_retrieval_timeout_seconds: float = 1.5
    chat_retrieval_chunk_chars: int = 500

    # Support launching uvicorn from either repo root or be/ directory.
    model_config = SettingsConfigDict(
        env_file=("be/.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
