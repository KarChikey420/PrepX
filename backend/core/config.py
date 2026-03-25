"""
core.config
~~~~~~~~~~~
Centralized application settings loaded from environment variables via Pydantic V2.
"""

from __future__ import annotations

from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
        ],
        description="Allowed CORS origins",
    )
    app_name: str = Field(default="AI Voice Interviewer", description="Application display name")
    app_version: str = Field(default="1.0.0", description="Application version")


# Singleton settings instance — imported across the app.
settings = Settings()  # type: ignore[call-arg]
