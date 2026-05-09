from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Mi App"
    debug: bool = False

    # PostgreSQL (Supabase)
    database_url: str

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""

    # JWT
    jwt_secret: str = "changeme-super-secret-key-at-least-32-chars"
    jwt_expire_hours: int = 24

    # Admin
    admin_username: str = "admin"
    admin_password_hash: str = "$2b$12$placeholder"

    # Supabase Storage
    use_supabase_storage: bool = True
    supabase_storage_bucket: str = "vouchers"


settings = Settings()  # type: ignore[call-arg]
