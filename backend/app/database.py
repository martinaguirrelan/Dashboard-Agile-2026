import logging
from urllib.parse import urlparse
import psycopg2
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import settings

logger = logging.getLogger(__name__)

# urlparse correctly decodes %3F→? and %2B→+ in passwords,
# then we pass each component to psycopg2 directly (no URL-encoding issues)
_raw = settings.database_url
if _raw.startswith("postgres://"):
    _raw = "postgresql://" + _raw[len("postgres://"):]
_p = urlparse(_raw)

logger.info("DB connecting to %s:%s db=%s", _p.hostname, _p.port, _p.path.lstrip("/"))


def _get_conn():
    return psycopg2.connect(
        host=_p.hostname,
        port=_p.port or 5432,
        user=_p.username,
        password=_p.password,
        dbname=(_p.path or "/postgres").lstrip("/"),
        sslmode="require",
    )


engine = create_engine(
    "postgresql+psycopg2://",
    creator=_get_conn,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
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
