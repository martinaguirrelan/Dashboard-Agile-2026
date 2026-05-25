from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from ..config import settings
from ..database import get_db
from ..models.jira_epic import ConfigProject, JiraEpic, SyncLog, SyncMetric
from ..schemas.jira_epic import SyncResultOut, SyncLogOut, SyncMetricOut
from ..services.auth_service import require_admin
from ..services.jira_client import _headers
from ..services.sync_service import run_sync

import httpx

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/run", response_model=SyncResultOut, dependencies=[Depends(require_admin)])
def trigger_sync():
    """Dispara la sincronización on-demand (requiere token admin)."""
    return run_sync()


@router.post("/full", response_model=SyncResultOut, dependencies=[Depends(require_admin)])
def trigger_full_sync():
    """Dispara un full sync forzando traer todos los épicos (requiere token admin)."""
    return run_sync(force_full_sync=True)


@router.get("/debug-fields/{project_key}")
def debug_jira_fields(project_key: str):
    """Devuelve el raw de los custom fields de sprint/estimación del primer epic del proyecto."""
    target_fields = [
        settings.jira_field_sprint_inicio,
        settings.jira_field_estimacion_ini,
        settings.jira_field_estimacion_fin,
        settings.jira_field_sprint_fin,
        settings.jira_field_estado_iniciativa,
        settings.jira_field_fecha_done,
        settings.jira_field_fecha_prd,
    ]
    jql = f'project = "{project_key}" AND issuetype = Epic ORDER BY created DESC'
    url = f"{settings.jira_base_url}/rest/api/3/search/jql"
    body = {"jql": jql, "maxResults": 3, "fields": target_fields + ["summary", "status"]}
    with httpx.Client(headers=_headers(), timeout=30) as client:
        resp = client.post(url, json=body)
        resp.raise_for_status()
    data = resp.json()
    return {
        "project_key": project_key,
        "field_ids": {
            "sprint_inicio": settings.jira_field_sprint_inicio,
            "estimacion_ini": settings.jira_field_estimacion_ini,
            "estimacion_fin": settings.jira_field_estimacion_fin,
            "sprint_fin": settings.jira_field_sprint_fin,
        },
        "epics_raw": [
            {
                "key": i["key"],
                "summary": i["fields"].get("summary"),
                "fields": {k: i["fields"].get(k) for k in target_fields},
            }
            for i in data.get("issues", [])
        ],
    }


@router.get("/status")
def sync_status(db: Session = Depends(get_db)):
    """Resumen del estado actual sin autenticación."""
    total = db.query(JiraEpic).count()
    projects = db.query(ConfigProject).all()
    return {
        "total_epics": total,
        "projects": [
            {
                "key": p.project_key,
                "name": p.project_name,
                "active": p.is_active,
            }
            for p in projects
        ],
    }


@router.get("/logs")
def get_sync_logs(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    """Últimos N días de histórico de sincronización (sin autenticación)."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        logs = db.query(SyncLog).filter(SyncLog.created_at >= since).all()
        logger.info(f"Found {len(logs)} sync logs")
        result = []
        for log in logs:
            logger.info(f"Processing log: {log.id}")
            log_dict = {
                "id": str(log.id),
                "sync_type": log.sync_type,
                "started_at": log.started_at.isoformat() if log.started_at else None,
                "ended_at": log.ended_at.isoformat() if log.ended_at else None,
                "duration_seconds": log.duration_seconds,
                "total_upserted": log.total_upserted,
                "total_errors": log.total_errors,
                "status": log.status,
                "error_message": log.error_message,
                "projects_detail": log.projects_detail,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            result.append(log_dict)
        logger.info(f"Returning {len(result)} logs")
        return result
    except Exception as e:
        logger.error(f"Error fetching sync logs: {e}", exc_info=True)
        return {"error": str(e)}


@router.get("/summary")
def sync_summary(db: Session = Depends(get_db)):
    """Resumen de últimas 24h de sincronización (métricas rápidas, sin autenticación)."""
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    logs = db.query(SyncLog).filter(SyncLog.created_at >= since).all()

    if not logs:
        return {
            "sync_count": 0,
            "avg_duration_seconds": None,
            "total_epics": 0,
            "total_errors": 0,
            "error_rate": 0,
            "last_sync": None,
        }

    total_duration = sum(log.duration_seconds or 0 for log in logs)
    total_upserted = sum(log.total_upserted or 0 for log in logs)
    total_errors = sum(log.total_errors or 0 for log in logs)

    avg_duration = total_duration / len(logs) if logs else None
    error_rate = (total_errors / (total_upserted + total_errors) * 100) if (total_upserted + total_errors) > 0 else 0

    return {
        "sync_count": len(logs),
        "avg_duration_seconds": round(avg_duration, 2) if avg_duration else None,
        "total_epics": total_upserted,
        "total_errors": total_errors,
        "error_rate": round(error_rate, 2),
        "last_sync": logs[0].created_at if logs else None,
    }


@router.get("/metrics", response_model=list[SyncMetricOut])
def get_sync_metrics(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    """Métricas diarias de últimos N días (sin autenticación)."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).date()
    metrics = db.query(SyncMetric).filter(SyncMetric.date >= since).order_by(SyncMetric.date.desc()).all()
    return metrics
