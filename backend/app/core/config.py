from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "NOVA"
    app_env: str = "development"
    database_url: str = "sqlite:///./nova_dev.db"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = Field(default="dev-access-secret", min_length=12)
    jwt_refresh_secret: str = Field(default="dev-refresh-secret", min_length=12)
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    ai_mode: str = "auto"
    ai_provider: str = "deterministic"
    ai_api_key: str | None = None
    ai_model: str | None = None
    ai_timeout_seconds: float = 30.0
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @model_validator(mode="after")
    def reject_default_jwt_secrets_outside_dev(self) -> "Settings":
        safe_envs = {"dev", "development", "local", "test", "testing"}
        default_secrets = {
            "dev-access-secret",
            "dev-refresh-secret",
            "change-me-access-secret",
            "change-me-refresh-secret",
        }
        if self.app_env.lower() not in safe_envs and (
            self.jwt_secret in default_secrets or self.jwt_refresh_secret in default_secrets
        ):
            raise ValueError("JWT secrets must be set to non-default values outside development/test environments")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
