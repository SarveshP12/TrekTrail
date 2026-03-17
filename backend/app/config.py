from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "TrekTrack AI"
    debug: bool = False
    database_url: str = "postgresql+asyncpg://postgres:Shaily%401201@localhost:5440/trektrack"
    timescale_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/trektrack_ts"
    redis_url: str = "redis://localhost:6379"
    jwt_secret: str = "change-me-in-production"
    cors_origins: list[str] = ["*"]

    model_config = {"env_file": ".env"}


settings = Settings()
