from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Envest BE"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/envest"
    vector_db_address: str = "localhost:50051"

    vector_doc_collection: str = "document_chunks"
    vector_turn_collection: str = "conversation_turns"
    embedding_dimension: int = 768

    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"
    openai_api_key: str = ""

    llama_parse_api_key: str = ""
    upload_dir: str = "be/uploads"
    chunk_size_chars: int = 3000
    chunk_overlap_chars: int = 400

    model_config = SettingsConfigDict(env_file="be/.env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
