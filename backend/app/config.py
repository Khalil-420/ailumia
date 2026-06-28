from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 8
    zimbra_url: str
    zimbra_verify_ssl: bool = False
    zimbra_domain: str
    zimbra_host: str
    sg_api_key: str
    sendgrid_from_email: str
    ai_api_key: str
    ai_model: str = "llama3-70b-8192"
    app_env: str = "development"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
