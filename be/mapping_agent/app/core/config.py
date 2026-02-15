from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Envest Mapping API"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8001
    log_level: str = "INFO"
    openaq_api_key: str = ""

    # Works when launched from repo root or from be/mapping_agent.
    model_config = SettingsConfigDict(
        env_file=("be/mapping_agent/.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
