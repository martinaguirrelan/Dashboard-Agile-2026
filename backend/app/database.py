import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import settings

logger = logging.getLogger(__name__)

# Supabase connection strings use "postgres://" but SQLAlchemy requires "postgresql://"
_db_url = settings.database_url.replace("postgres://", "postgresql://", 1)

# Remove sslmode from URL if present — we enforce it via connect_args instead
if "?" in _db_url:
    _db_url = _db_url.split("?")[0]

logger.info("DB host: %s", _db_url.split("@")[-1] if "@" in _db_url else "unknown")

engine = create_engine(
    _db_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"sslmode": "require"},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("DB connection check failed: %s", e)
        return False
