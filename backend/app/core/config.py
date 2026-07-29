from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SmartAttend AI"
    api_prefix: str = "/api/v1"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/smartattend"
    secret_key: str = Field(default="change-me-in-production")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    cors_origins: list[str] = ["http://localhost:5173"]
    face_model_name: str = "buffalo_l"
    face_provider: str = "CPUExecutionProvider"
    face_similarity_threshold: float = 0.58
    face_detection_size: int = 640
    face_max_embeddings_per_student: int = 5
    face_upload_root: Path = Path("storage/face_uploads")
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@smartattend.local"
    frontend_url: str = "http://localhost:5173"
    student_email_domain: str = "imsec.ac.in"
    refresh_token_expire_days: int = 30
    activation_token_expire_hours: int = 24
    reset_token_expire_hours: int = 1

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
