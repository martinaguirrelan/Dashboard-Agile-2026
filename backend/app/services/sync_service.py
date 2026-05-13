"""
US-4: Motor de sincronización Jira → Supabase.
Upsert basado en jira_issue_id para evitar duplicados.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.jira_epic import ConfigProject, JiraEpic
from .jira_client import fetch_epics_for_project

logger = logging.getLogger(__name__)

_DIVIDER = "━" * 48


def _active_project_keys(db: Session) -> list[str]:
    rows = db.query(ConfigProject.project_key).filter(ConfigProject.is_active.is_(True)).all()
    return [r[0] for r in rows]


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
                        "status":             epic.get("status"),
                        "assignee":           epic.get("assignee"),
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


def run_sync() -> dict:
    """
    Sincroniza todas las épicas de los proyectos activos.
    Puede llamarse desde el scheduler o desde el endpoint on-demand.
    """
    logger.info(_DIVIDER)
    logger.info("🔄  Sincronización Jira → Supabase iniciada")
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

        for key in keys:
            logger.info("  → %s", key)
            try:
                epics = fetch_epics_for_project(key)
                upserted, errors, err_details = _upsert_epics(db, epics)
                total_upserted += upserted
                total_errors   += errors
                entry: dict = {"key": key, "epics": upserted, "errors": errors}
                if err_details:
                    entry["error_details"] = err_details
                projects_result.append(entry)
            except Exception as exc:
                logger.error("  ✗ Error en proyecto %s: %s", key, exc)
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
        "started_at": started_at.isoformat(),
        "duration_seconds": round(duration, 2),
        "total_upserted": total_upserted,
        "total_errors": total_errors,
        "projects": projects_result,
    }
