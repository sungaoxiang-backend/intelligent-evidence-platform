from locale import strcoll
from typing import Any, Dict, List, Optional

from pydantic import AnyHttpUrl, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore")

    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS配置
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str] | str:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # 数据库配置
    POSTGRES_SERVER: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    SQLALCHEMY_DATABASE_URI: Optional[PostgresDsn] = None

    @field_validator("SQLALCHEMY_DATABASE_URI", mode="before")
    def assemble_db_connection(cls, v: Optional[str], values: Dict[str, Any]) -> Any:
        if isinstance(v, str):
            return v
        return PostgresDsn.build(
            scheme="postgresql+asyncpg",
            username=values.data.get("POSTGRES_USER"),
            password=values.data.get("POSTGRES_PASSWORD"),
            host=values.data.get("POSTGRES_SERVER"),
            path=f"{values.data.get('POSTGRES_DB') or ''}",
        )

    # 腾讯云COS配置
    COS_SECRET_ID: str
    COS_SECRET_KEY: str
    COS_REGION: str
    COS_BUCKET: str
    COS_BUCKET_SERVICE: str = None
    
    @field_validator("COS_BUCKET_SERVICE", mode="before")
    def assemble_cos_bucket_service(cls, v: Optional[str], values: Dict[str, Any]) -> Any:
        if isinstance(v, str):
            return v
        return f"https://{values.data.get('COS_BUCKET')}.cos.{values.data.get('COS_REGION')}.myqcloud.com"

    # 超级管理员初始配置
    FIRST_SUPERUSER_USERNAME: str
    FIRST_SUPERUSER_PASSWORD: str

    # 讯飞OCR配置
    XUNFEI_OCR_API_KEY: str
    XUNFEI_OCR_API_SECRET: str
    XUNFEI_OCR_APP_ID: str
    XUNFEI_OCR_INVOICE_API_URL: str # 用于通用票证识别
    XUNFEI_OCR_GENERAL_API_URL: str # 用于通用OCR识别
    XUNFEI_OCR_TIMEOUT: str
    # ----------------------- Agentic ------------------------------------
    
    # Qwen llm
    QWEN_API_KEY: str
    QWEN_BASE_URL: str
    QWEN_CHAT_MODEL: str
    QWEN_MUTI_MODEL: str
    QWEN_OPENAI_EMBEDDER_MODEL: str

    # Openai llm
    OPENAI_API_KEY: str
    OPENAI_IMAGE_MODEL: str
    OPENAI_BASE_URL: str


settings = Settings()