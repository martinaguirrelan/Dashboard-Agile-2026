from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.jira_epic import ConfigProject, JiraEpic
from ..schemas.jira_epic import ConfigProjectOut, JiraEpicOut

router = APIRouter(prefix="/epics", tags=["epics"])


class ProjectCreate(BaseModel):
    project_key: str
    project_name: str | None = None
    vp: str | None = None


@router.get("/vps", response_model=list[str])
def list_vps(db: Session = Depends(get_db)):
    rows = (
        db.query(ConfigProject.vp)
        .filter(ConfigProject.is_active.is_(True), ConfigProject.vp.isnot(None))
        .distinct()
        .order_by(ConfigProject.vp)
        .all()
    )
    return [r[0] for r in rows]


@router.get("/projects", response_model=list[ConfigProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return (
        db.query(ConfigProject)
        .filter(ConfigProject.is_active.is_(True))
        .order_by(ConfigProject.project_name)
        .all()
    )


@router.post("/projects", response_model=ConfigProjectOut)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    existing = db.query(ConfigProject).filter_by(project_key=project.project_key).first()
    if existing:
        existing.is_active = True
        if project.project_name:
            existing.project_name = project.project_name
        if project.vp:
            existing.vp = project.vp
    else:
        existing = ConfigProject(
            project_key=project.project_key,
            project_name=project.project_name,
            vp=project.vp,
            is_active=True
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return existing


@router.get("/", response_model=list[JiraEpicOut])
def list_epics(
    project_key: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(JiraEpic)
    if project_key:
        q = q.filter(JiraEpic.project_key == project_key)
    if status:
        q = q.filter(JiraEpic.status == status)
    return q.order_by(JiraEpic.due_date.asc().nullslast()).all()


@router.get("/stats")
def epics_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func
    rows = (
        db.query(JiraEpic.status, func.count(JiraEpic.id).label("count"))
        .group_by(JiraEpic.status)
        .all()
    )
    avg_lead = db.query(func.avg(JiraEpic.lead_time_days)).scalar()
    return {
        "by_status": {r.status or "Sin estado": r.count for r in rows},
        "avg_lead_time_days": round(float(avg_lead), 1) if avg_lead else None,
        "total": sum(r.count for r in rows),
    }
