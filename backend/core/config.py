from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = "http://127.0.0.1:54321"
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = "super-secret-jwt-token-with-at-least-32-characters-long"

    # LLM
    llm_provider: str = "anthropic"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # Embeddings
    embeddings_provider: str = "openai"
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"

    # Email
    email_provider: str = "resend"
    resend_api_key: str = ""
    email_from: str = "CafeRoam <noreply@caferoam.tw>"

    # Analytics
    analytics_provider: str = "posthog"
    posthog_api_key: str = ""
    posthog_host: str = "https://app.posthog.com"

    # Maps
    maps_provider: str = "mapbox"
    mapbox_access_token: str = ""

    # Scraper
    scraper_provider: str = "apify"
    apify_api_token: str = ""

    # Sentry
    sentry_dsn: str = ""

    # App
    environment: str = "development"
    log_level: str = "INFO"

    # Admin
    admin_user_ids: list[str] = []

    # Worker concurrency
    worker_poll_interval_seconds: int = 5
    worker_concurrency_enrich: int = 3
    worker_concurrency_embed: int = 20
    worker_concurrency_publish: int = 20
    worker_concurrency_scrape: int = 1
    worker_concurrency_default: int = 1

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
