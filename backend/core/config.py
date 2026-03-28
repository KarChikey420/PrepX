"""
core.config
~~~~~~~~~~~
Centralized application settings loaded from environment variables via Pydantic V2.
"""

from __future__ import annotations

from typing import List

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import json


class Settings(BaseSettings):
    """Application-wide configuration backed by .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── LLM (Kimi K2 via NVIDIA) ──────────────────────────────────────
    kimi_api_key: str = Field(..., description="NVIDIA API key for Kimi K2")
    kimi_base_url: str = Field(
        default="https://api.moonshot.cn/v1",
        description="OpenAI-compatible base URL for Kimi K2",
    )
    kimi_model: str = Field(
        default="moonshot-v1-8k",
        description="Model identifier for Kimi K2",
    )

    # ── Database (MongoDB Atlas) ───────────────────────────────────────
    mongo_link: str = Field(..., description="MongoDB connection URI")
    mongodb_db_name: str = Field(
        default="voice_interviewer",
        description="MongoDB database name",
    )

    # ── Voice: Deepgram (STT & TTS) ────────────────────────────────────
    deepgram_api_key: str = Field(..., description="Deepgram API key")
    deepgram_stt_model: str = Field(
        default="nova-2",
        description="Deepgram STT model identifier",
    )
    deepgram_tts_model: str = Field(
        default="aura-athena-en",
        description="Deepgram TTS model identifier",
    )

    # ── Cache (Upstash Redis REST) ─────────────────────────────────────
    upstash_redis_rest_url: str = Field(..., description="Upstash Redis REST endpoint")
    upstash_redis_rest_token: str = Field(..., description="Upstash Redis REST auth token")

    # ── Application ────────────────────────────────────────────────────
    log_level: str = Field(default="INFO", description="Logging level")
    cors_origins: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "https://prep-x-omega.vercel.app",
        ],
        description="Allowed CORS origins",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            try:
                # Try parsing as JSON first (e.g., ["http://localhost:3000"])
                return json.loads(v)
            except json.JSONDecodeError:
                # Fallback to comma-separated string
                return [origin.strip() for origin in v.split(",")]
        return v

    app_name: str = Field(default="PrepX AI Interviewer", description="Application display name")
    app_version: str = Field(default="1.0.0", description="Application version")

    # ── Authentication (JWT) ──────────────────────────────────────────
    jwt_secret_key: str = Field(..., description="JWT signing secret key")
    jwt_algorithm: str = Field(default="HS256", description="JWT hashing algorithm")
    access_token_expire_minutes: int = Field(default=30, description="Access token expiry (minutes)")
    refresh_token_expire_days: int = Field(default=7, description="Refresh token expiry (days)")

    # ── Google OAuth ──────────────────────────────────────────────────
    frontend_base_url: str = Field(
        default="http://localhost:5173",
        validation_alias=AliasChoices("FRONTEND_BASE_URL", "frontend_base_url"),
        description="Frontend base URL used for auth success/error redirects",
    )
    google_oauth_redirect_uri: str = Field(
        default="http://localhost:8000/api/v1/auth/callback",
        validation_alias=AliasChoices("GOOGLE_OAUTH_REDIRECT_URI", "google_oauth_redirect_uri"),
        description="Exact Google OAuth redirect URI registered in Google Cloud Console",
    )
    google_client_id: str = Field(
        ...,
        validation_alias=AliasChoices("GOOGLE_CLIENT_ID", "google_client_id", "client-id"),
        description="Google OAuth Client ID",
    )
    google_client_secret: str = Field(
        ...,
        validation_alias=AliasChoices("GOOGLE_CLIENT_SECRET", "google_client_secret", "client-secret"),
        description="Google OAuth Client Secret",
    )


# Singleton settings instance — imported across the app.
settings = Settings()  # type: ignore[call-arg]
