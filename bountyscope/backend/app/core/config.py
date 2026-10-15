from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./bountyscope.db"
    redis_url: str = "redis://localhost:6379/0"
    api_token: str = ""
    ai_enabled: bool = False
    ai_provider: str = "openai"
    openai_api_key: str = ""
    openai_model: str = ""
    anthropic_api_key: str = ""
    anthropic_model: str = ""
    ai_max_rounds: int = 3
    ai_max_actions_per_round: int = 20
    evidence_retention_days: int = 30
    user_agent: str = "BountyScope-SecurityScanner/1.0"


settings = Settings()
