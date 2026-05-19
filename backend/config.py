from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://user:password@localhost:5432/prlab_assets"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_hours: int = 24
    google_client_id: str = "placeholder"
    google_client_secret: str = "placeholder"
    app_env: str = "development"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


settings = Settings()
