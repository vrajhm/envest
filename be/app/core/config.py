from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Envest RAG API"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    vector_db_address: str = "localhost:50051"
    vector_backend: str = "actian"
    vector_auto_fallback_memory: bool = True
    vector_collection_per_goal_scores: str = "per_goal_scores"
    vector_collection_vulnerable_clauses: str = "vulnerable_clauses"
    vector_collection_conversation_turns: str = "conversation_turns"
    vector_collection_review_sessions: str = "review_sessions"
    vector_distance_metric: str = "COSINE"
    vector_hnsw_m: int = 16
    vector_hnsw_ef_construct: int = 200
    vector_hnsw_ef_search: int = 50

    embedding_dim: int = 768
    embedding_model: str = "models/gemini-embedding-001"

    gemini_model: str = "models/gemini-3-flash-preview"
    gemini_api_key: str = ""

    artifacts_dir: str = "be/artifacts"

    model_config = SettingsConfigDict(env_file="be/.env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
