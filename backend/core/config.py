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

    # ── Voice: STT (NVIDIA Nematron) ───────────────────────────────────
    nematron_asr_stt: str = Field(..., alias="nematron_ASR_STT", description="API key for NVIDIA Nematron STT")
    nematron_stt_base_url: str = Field(
        default="https://integrate.api.nvidia.com/v1",
        description="Base URL for Nematron STT API",
    )
    nematron_stt_model: str = Field(
        default="b702f636-f60c-4a3d-a6f4-f3568c13bd7d",
        description="Nematron STT model identifier",
    )

    # ── Voice: TTS (NVIDIA Riva) ───────────────────────────────────────
    nvidia_riva_tts: str = Field(..., alias="nvidia_riva_TTs", description="API key for NVIDIA Riva TTS")
    nvidia_riva_tts_base_url: str = Field(
        default="https://integrate.api.nvidia.com/v1",
        description="Base URL for NVIDIA Riva TTS API",
    )
    nvidia_riva_tts_model: str = Field(
        default="877104f7-e885-42b9-8de8-f6e4c6303969",
        description="NVIDIA Riva TTS model identifier",
    )
    nvidia_riva_tts_voice: str = Field(
        default="Magpie-Multilingual.EN-US.Aria",
        description="NVIDIA Riva TTS voice identifier",
    )

    # ── Cache (Upstash Redis REST) ─────────────────────────────────────
    upstash_redis_rest_url: str = Field(..., description="Upstash Redis REST endpoint")
    upstash_redis_rest_token: str = Field(..., description="Upstash Redis REST auth token")

    # ── Application ────────────────────────────────────────────────────
    log_level: str = Field(default="INFO", description="Logging level")
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        description="Allowed CORS origins",
    )
    app_name: str = Field(default="AI Voice Interviewer", description="Application display name")
    app_version: str = Field(default="1.0.0", description="Application version")


# Singleton settings instance — imported across the app.
settings = Settings()  # type: ignore[call-arg]
