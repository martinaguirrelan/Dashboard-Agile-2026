from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.jira_epic import ConfigProject, JiraEpic
from ..schemas.jira_epic import SyncResultOut
from ..services.auth_service import require_admin
from ..services.sync_service import run_sync

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/run", response_model=SyncResultOut, dependencies=[Depends(require_admin)])
def trigger_sync():
    """Dispara la sincronización on-demand (requiere token admin)."""
    return run_sync()


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
