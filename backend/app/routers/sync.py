from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import logging

from ..config import settings
from ..database import get_db
from ..models.jira_epic import ConfigProject, JiraEpic, SyncLog, SyncMetric
from ..schemas.jira_epic import SyncResultOut, SyncLogOut, SyncMetricOut
from ..services.auth_service import require_admin
from ..services.jira_client import _headers
from ..services.sync_service import run_sync
from ..services.jira_sync_service import JiraSyncService
from ..schemas.jira_issue import JiraIssueSyncStats

import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync", tags=["sync"])

# Store last sync status for issues
last_issues_sync_status: dict = {}


@router.post("/run", response_model=SyncResultOut, dependencies=[Depends(require_admin)])
def trigger_sync():
    """Dispara la sincronización on-demand (requiere token admin)."""
    return run_sync()


@router.post("/full", response_model=SyncResultOut, dependencies=[Depends(require_admin)])
def trigger_full_sync():
    """Dispara un full sync forzando traer todos los épicos (requiere token admin)."""
    return run_sync(force_full_sync=True)


@router.get("/issues/test-insert")
def test_single_insert(db: Session = Depends(get_db)):
    """Test inserting a single mock issue to diagnose DB errors."""
    import traceback, uuid
    from ..models.jira_issue import JiraIssue
    try:
        mock = JiraIssue(
            jira_issue_id=f"TEST-{uuid.uuid4().hex[:6]}",
            project_key="TEST",
            issue_type="Task",
            summary="Test issue from diagnostic endpoint",
        )
        db.add(mock)
        db.commit()
        db.refresh(mock)
        db.delete(mock)
        db.commit()
        return {"status": "ok", "message": "Insert and delete successful"}
    except Exception as e:
        db.rollback()
        return {"status": "error", "error": str(e), "type": type(e).__name__, "traceback": traceback.format_exc()}


@router.get("/jira-diagnostic")
def jira_diagnostic():
    """Diagnóstico completo de la conexión Jira — muestra config y prueba la API."""
    import base64
    base_url = settings.jira_url
    email = settings.jira_user_email
    token = settings.jira_api_token

    config_ok = bool(email and token and base_url and "your-org" not in base_url)

    result = {
        "config": {
            "jira_base_url": base_url,
            "jira_user_email": email or "⚠️ NOT SET",
            "jira_api_token": "✅ SET" if token else "⚠️ NOT SET",
            "config_valid": config_ok,
        },
        "connection_test": None,
        "issues_jql_test": None,
    }

    if not config_ok:
        result["connection_test"] = {
            "status": "skipped",
            "reason": "Jira credentials not configured in environment variables",
        }
        return result

    # Test 1: Conectar a Jira
    try:
        url = f"{base_url}/rest/api/3/myself"
        with httpx.Client(headers=_headers(), timeout=10) as client:
            resp = client.get(url)
            result["connection_test"] = {
                "status": "ok" if resp.status_code == 200 else "error",
                "http_status": resp.status_code,
                "account": resp.json().get("displayName", "unknown") if resp.status_code == 200 else resp.text[:200],
            }
    except Exception as e:
        result["connection_test"] = {"status": "exception", "error": str(e)}

    # Test 2: JQL de issues
    try:
        url = f"{base_url}/rest/api/3/search/jql"
        jql = "project = SVI AND type in (Task, Bug, Story, Sub-task) ORDER BY updated DESC"
        body = {"jql": jql, "maxResults": 3, "fields": ["summary", "status", "issuetype"]}
        with httpx.Client(headers=_headers(), timeout=15) as client:
            resp = client.post(url, json=body)
            if resp.status_code == 200:
                data = resp.json()
                issues = data.get("issues", [])
                result["issues_jql_test"] = {
                    "status": "ok",
                    "total_available": data.get("total", 0),
                    "sample": [{"key": i["key"], "summary": i["fields"].get("summary")} for i in issues],
                }
            else:
                result["issues_jql_test"] = {
                    "status": "error",
                    "http_status": resp.status_code,
                    "response": resp.text[:300],
                }
    except Exception as e:
        result["issues_jql_test"] = {"status": "exception", "error": str(e)}

    return result


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
    url = f"{settings.jira_url}/rest/api/3/search/jql"
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
    since = datetime.now(timezone.utc) - timedelta(days=days)
    logs = db.query(SyncLog).filter(SyncLog.created_at >= since).order_by(SyncLog.created_at.desc()).all()

    result = []
    for log in logs:
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
    return result


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


# ============================================================================
# JIRA ISSUES SYNC ENDPOINTS (for individual items/issues table)
# ============================================================================

@router.post("/issues/run")
async def run_issues_full_sync(
    project_key: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Trigger a full sync of Jira issues (individual items) to Supabase"""
    try:
        logger.info(f"📋 Full issues sync requested for project: {project_key}")

        background_tasks.add_task(
            _run_issues_sync_background,
            project_key,
            db,
            sync_type="full",
        )

        return {
            "status": "queued",
            "message": f"Full sync started for issues in project {project_key}",
            "project_key": project_key,
            "sync_type": "FULL",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"❌ Error starting issues sync: {e}")
        return {"status": "error", "message": str(e)}, 500


@router.post("/issues/diferencial")
async def run_issues_differential_sync(
    project_key: str,
    hours: int = 1,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    """Trigger a differential sync of recently modified Jira issues"""
    try:
        logger.info(f"📋 Differential issues sync requested for project: {project_key}")

        if background_tasks:
            background_tasks.add_task(
                _run_issues_sync_background,
                project_key,
                db,
                sync_type="differential",
                hours=hours,
            )

        return {
            "status": "queued",
            "message": f"Differential sync started for issues in project {project_key}",
            "project_key": project_key,
            "sync_type": "DIFERENCIAL",
            "hours": hours,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"❌ Error starting issues sync: {e}")
        return {"status": "error", "message": str(e)}, 500


@router.get("/issues/status")
async def get_issues_sync_status(project_key: str = None):
    """Get status of the last issues sync"""
    if not last_issues_sync_status:
        return {
            "status": "never_run",
            "message": "No issues sync has been executed yet",
        }

    if project_key:
        return last_issues_sync_status.get(project_key, {"status": "never_run"})

    return last_issues_sync_status


async def _run_issues_sync_background(
    project_key: str,
    db: Session,
    sync_type: str = "full",
    hours: int = 1,
):
    """Background task to run issues sync"""
    global last_issues_sync_status

    try:
        if sync_type == "full":
            result = await JiraSyncService.run_full_sync(db, project_key)
        else:
            result = await JiraSyncService.run_differential_sync(
                db,
                project_key,
                hours=hours,
            )

        # Store status
        last_issues_sync_status[project_key] = {
            "status": result.get("status", "unknown"),
            "total_processed": result.get("total_processed", 0),
            "total_upserted": result.get("total_upserted", 0),
            "total_errors": result.get("total_errors", 0),
            "first_error": result.get("first_error"),
            "sync_type": result.get("sync_type", "UNKNOWN"),
            "started_at": result.get("started_at"),
            "completed_at": result.get("completed_at"),
        }

        logger.info(f"✅ Issues sync completed: {result}")

    except Exception as e:
        logger.error(f"❌ Issues sync failed: {e}")
        last_issues_sync_status[project_key] = {
            "status": "failed",
            "error": str(e),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
