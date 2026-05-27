"""
Endpoints para el módulo Capacity Ejecutivo (Issues por Sprint).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.jira_epic import JiraIssue
from ..services.issues_sync_service import run_issues_sync

router = APIRouter(prefix="/api/issues", tags=["issues"])


@router.get("/sync")
def sync_issues_now(db: Session = Depends(get_db)) -> dict:
    """Ejecuta sincronización de issues desde Jira."""
    result = run_issues_sync(force_full=False)
    return result


@router.get("/sprint/{sprint_key}")
def get_issues_by_sprint(sprint_key: str, db: Session = Depends(get_db)) -> list[dict]:
    """Obtiene todos los issues de un sprint específico."""
    issues = db.query(JiraIssue).filter(JiraIssue.sprint_key == sprint_key).all()
    return [_issue_to_dict(issue) for issue in issues]


@router.get("/project/{project_key}")
def get_issues_by_project(project_key: str, db: Session = Depends(get_db)) -> list[dict]:
    """Obtiene todos los issues de un proyecto."""
    issues = db.query(JiraIssue).filter(JiraIssue.project_key == project_key).all()
    return [_issue_to_dict(issue) for issue in issues]


@router.get("/quarter/{quarter}")
def get_issues_by_quarter(quarter: str, db: Session = Depends(get_db)) -> list[dict]:
    """Obtiene issues del trimestre (ej. Q2-2026)."""
    # Issues cuyos sprints pertenecen al trimestre
    issues = db.query(JiraIssue).filter(
        JiraIssue.sprint_key.contains(quarter)
    ).all()
    return [_issue_to_dict(issue) for issue in issues]


@router.get("/capacity/{quarter}")
def get_capacity_by_quarter(quarter: str, db: Session = Depends(get_db)) -> dict:
    """Retorna métricas de capacidad del trimestre."""
    issues = db.query(JiraIssue).filter(
        JiraIssue.sprint_key.contains(quarter)
    ).all()

    total_story_points = sum(i.story_points or 0 for i in issues)
    done_count = sum(1 for i in issues if i.estado and "terminado" in i.estado.lower())
    in_progress = sum(1 for i in issues if i.estado and "proceso" in i.estado.lower())

    return {
        "quarter": quarter,
        "total_issues": len(issues),
        "total_story_points": total_story_points,
        "done": done_count,
        "in_progress": in_progress,
        "todo": len(issues) - done_count - in_progress,
    }


def _issue_to_dict(issue: JiraIssue) -> dict:
    """Convierte un Issue ORM a dict."""
    return {
        "id": str(issue.id),
        "jira_issue_id": issue.jira_issue_id,
        "issue_type": issue.issue_type,
        "summary": issue.summary,
        "story_points": issue.story_points,
        "estado": issue.estado,
        "assignee": issue.assignee,
        "priority": issue.priority,
        "sprint_key": issue.sprint_key,
        "parent_issue_key": issue.parent_issue_key,
        "parent_summary": issue.parent_summary,
        "labels": issue.labels,
        "resolution": issue.resolution,
        "tipo_iniciativa": issue.tipo_iniciativa,
        "project_key": issue.project_key,
        "created_at": issue.created_at.isoformat() if issue.created_at else None,
        "updated_at": issue.updated_at.isoformat() if issue.updated_at else None,
    }
