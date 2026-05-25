from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models.jira_epic import ConfigProject, JiraEpic
from ..schemas.jira_epic import SyncResultOut
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
