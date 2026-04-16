from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    deepseek_api_key: str
    cors_origins: list[str] = ["http://localhost:5173"]
    class Config:
        env_file = ".env"

@lru_cache
def get_settings() -> Settings:
    return Settings()
