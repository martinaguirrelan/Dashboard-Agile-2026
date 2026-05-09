from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.jira_epic import JiraEpic
from ..schemas.jira_epic import JiraEpicOut

router = APIRouter(prefix="/epics", tags=["epics"])


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
