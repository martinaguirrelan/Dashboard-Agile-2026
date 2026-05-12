import logging

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import check_db_connection, Base, engine
from .routers import auth_router, items_router, sync_router, epics_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Agile Health Dashboard",
    version="1.0.0",
    debug=settings.debug,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(items_router, prefix="/api")
app.include_router(sync_router,  prefix="/api")
app.include_router(epics_router, prefix="/api")

# ── Scheduler (US-4) ─────────────────────────────────────────────────────────
_scheduler = BackgroundScheduler(timezone="UTC")


@app.on_event("startup")
def _start_scheduler() -> None:
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Tablas verificadas/creadas en base de datos.")
    except Exception as exc:
        logger.error("❌ Error al crear tablas en DB: %s", exc)

    from .services.sync_service import run_sync
    interval = settings.polling_interval_min
    _scheduler.add_job(run_sync, "interval", minutes=interval, id="jira_sync", replace_existing=True)
    _scheduler.start()
    logger.info("⏱️  Scheduler iniciado — sync cada %d min.", interval)


@app.on_event("shutdown")
def _stop_scheduler() -> None:
    _scheduler.shutdown(wait=False)


@app.get("/api/health", tags=["health"])
def health_check():
    db_ok = check_db_connection()
    return {
        "status": "ok",
        "db": "conectada" if db_ok else "sin conexión",
        "scheduler": "activo" if _scheduler.running else "inactivo",
    }
