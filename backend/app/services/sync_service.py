"""
US-4: Motor de sincronización Jira → Supabase.
Upsert basado en jira_issue_id para evitar duplicados.
Soporta sincronización diferencial y full sync cada 24h.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.jira_epic import ConfigProject, JiraEpic
from .jira_client import fetch_epics_for_project_async, fetch_epics_since_async

logger = logging.getLogger(__name__)

_DIVIDER = "━" * 48


def _active_project_keys(db: Session) -> list[str]:
    rows = db.query(ConfigProject.project_key).filter(ConfigProject.is_active.is_(True)).all()
    return [r[0] for r in rows]


def _get_project_config(db: Session, project_key: str) -> ConfigProject | None:
    return db.query(ConfigProject).filter_by(project_key=project_key).first()


def _upsert_epics(db: Session, epics: list[dict]) -> tuple[int, int, list[str]]:
    ok = errors = 0
    error_details: list[str] = []
    for epic in epics:
        try:
            stmt = (
                pg_insert(JiraEpic)
                .values(
                    jira_issue_id=epic["jira_issue_id"],
                    epic_name=epic["epic_name"],
                    description=epic.get("description"),
                    start_date=epic.get("start_date"),
                    due_date=epic.get("due_date"),
                    lead_time_days=epic.get("lead_time_days"),
                    status=epic.get("status"),
                    estado_normalizado=epic.get("estado_normalizado"),
                    assignee=epic.get("assignee"),
                    priority_status=epic.get("priority_status"),
                    priority_quarter=epic.get("priority_quarter"),
                    year=epic.get("year"),
                    quarter=epic.get("quarter"),
                    sprint_inicio=epic.get("sprint_inicio"),
                    estimacion_inicial=epic.get("estimacion_inicial"),
                    estimacion_final=epic.get("estimacion_final"),
                    estado_iniciativa=epic.get("estado_iniciativa"),
                    fecha_done=epic.get("fecha_done"),
                    fecha_prd=epic.get("fecha_prd"),
                    sprint_fin=epic.get("sprint_fin"),
                    project_key=epic["project_key"],
                    updated_at=datetime.now(timezone.utc),
                )
                .on_conflict_do_update(
                    index_elements=["jira_issue_id"],
                    set_={
                        "epic_name":          epic["epic_name"],
                        "description":        epic.get("description"),
                        "start_date":         epic.get("start_date"),
                        "due_date":           epic.get("due_date"),
                        "lead_time_days":     epic.get("lead_time_days"),
                        "status":              epic.get("status"),
                        "estado_normalizado":  epic.get("estado_normalizado"),
                        "assignee":            epic.get("assignee"),
                        "priority_status":    epic.get("priority_status"),
                        "priority_quarter":   epic.get("priority_quarter"),
                        "year":               epic.get("year"),
                        "quarter":            epic.get("quarter"),
                        "sprint_inicio":      epic.get("sprint_inicio"),
                        "estimacion_inicial": epic.get("estimacion_inicial"),
                        "estimacion_final":   epic.get("estimacion_final"),
                        "estado_iniciativa":  epic.get("estado_iniciativa"),
                        "fecha_done":         epic.get("fecha_done"),
                        "fecha_prd":          epic.get("fecha_prd"),
                        "sprint_fin":         epic.get("sprint_fin"),
                        "updated_at":         datetime.now(timezone.utc),
                    },
                )
            )
            db.execute(stmt)
            ok += 1
        except Exception as exc:
            msg = f"{epic.get('jira_issue_id')}: {exc}"
            logger.error("    ✗ upsert error %s", msg)
            error_details.append(msg)
            errors += 1
    db.commit()
    return ok, errors, error_details


async def _fetch_all_projects_async(
    keys: list[str],
    since_timestamp: str | None = None
) -> dict[str, list[dict]]:
    """Fetch todos los proyectos en paralelo (full o diferencial según since_timestamp)."""
    if since_timestamp:
        tasks = [fetch_epics_since_async(key, since_timestamp) for key in keys]
    else:
        tasks = [fetch_epics_for_project_async(key) for key in keys]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    project_epics: dict[str, list[dict]] = {}
    for key, result in zip(keys, results):
        if isinstance(result, Exception):
            logger.error("  ✗ Error fetching %s: %s", key, result)
            project_epics[key] = []
        else:
            project_epics[key] = result
    return project_epics


def run_sync(force_full_sync: bool = False) -> dict:
    """
    Sincroniza épicas de Jira → Supabase.
    - Si force_full_sync=False (default): Sync diferencial (solo cambios desde last_sync)
    - Si force_full_sync=True: Full sync (todos los épicos)
    """
    logger.info(_DIVIDER)
    sync_type = "FULL" if force_full_sync else "DIFERENCIAL"
    logger.info("🔄  Sincronización %s Jira → Supabase iniciada", sync_type)
    started_at = datetime.now(timezone.utc)

    db = SessionLocal()
    total_upserted = total_errors = 0
    projects_result: list[dict] = []

    try:
        keys = _active_project_keys(db)
        if not keys:
            logger.warning("⚠️  Sin proyectos activos en config_projects.")
            return {"status": "no_projects", "projects": []}

        logger.info("📋  Proyectos: %s", keys)

        # Determinar si es sync diferencial o full
        if force_full_sync:
            logger.info("  ℹ️  FULL SYNC — trayendo todos los épicos")
            project_epics = asyncio.run(_fetch_all_projects_async(keys, since_timestamp=None))
        else:
            # Sync diferencial: usar last_sync_timestamp de cada proyecto
            since_map: dict[str, str] = {}
            for key in keys:
                config = _get_project_config(db, key)
                if config and config.last_sync_timestamp:
                    since_map[key] = config.last_sync_timestamp.isoformat()
                else:
                    logger.info("  ℹ️  %s — primera sincronización (full)", key)

            # Fetch diferencial para los que tienen timestamp, full para los que no
            tasks_diff = [
                fetch_epics_since_async(key, since_map[key])
                for key in keys if key in since_map
            ]
            tasks_full = [
                fetch_epics_for_project_async(key)
                for key in keys if key not in since_map
            ]
            
            results = []
            if tasks_diff:
                results.extend(await asyncio.gather(*tasks_diff, return_exceptions=True))
            if tasks_full:
                results.extend(await asyncio.gather(*tasks_full, return_exceptions=True))

            project_epics: dict[str, list[dict]] = {}
            diff_keys = [k for k in keys if k in since_map]
            full_keys = [k for k in keys if k not in since_map]
            all_keys = diff_keys + full_keys
            
            for key, result in zip(all_keys, results):
                if isinstance(result, Exception):
                    logger.error("  ✗ Error fetching %s: %s", key, result)
                    project_epics[key] = []
                else:
                    project_epics[key] = result

        # Upsert resultados
        for key in keys:
            logger.info("  → %s", key)
            try:
                epics = project_epics.get(key, [])
                upserted, errors, err_details = _upsert_epics(db, epics)
                total_upserted += upserted
                total_errors += errors
                
                # Actualizar last_sync_timestamp
                config = _get_project_config(db, key)
                if config:
                    config.last_sync_timestamp = datetime.now(timezone.utc)
                    db.commit()
                
                entry: dict = {"key": key, "epics": upserted, "errors": errors}
                if err_details:
                    entry["error_details"] = err_details
                projects_result.append(entry)
            except Exception as exc:
                logger.error("  ✗ Error en upsert de %s: %s", key, exc)
                projects_result.append({"key": key, "epics": 0, "errors": 1, "error": str(exc)})
    finally:
        db.close()

    duration = (datetime.now(timezone.utc) - started_at).total_seconds()
    logger.info(
        "✅  Completado en %.1fs — épicas: %d | errores: %d",
        duration, total_upserted, total_errors,
    )
    logger.info(_DIVIDER)

    return {
        "status": "ok",
        "sync_type": sync_type,
        "started_at": started_at.isoformat(),
        "duration_seconds": round(duration, 2),
        "total_upserted": total_upserted,
        "total_errors": total_errors,
        "projects": projects_result,
    }


def run_full_sync() -> dict:
    """Ejecuta un full sync (fuerza traer todos los épicos)."""
    logger.info(_DIVIDER)
    logger.info("🔄  FULL SYNC PROGRAMADO cada 24h — limpiando registros orphaned")
    logger.info(_DIVIDER)
    return run_sync(force_full_sync=True)
