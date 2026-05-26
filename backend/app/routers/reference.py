"""
Datos de referencia: Trimestres y Sprints
Usado por Épicas 1 y 2
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.jira_epic import Trimestre, Sprint
from ..schemas.jira_epic import TrimestreOut, SprintOut

router = APIRouter(prefix="/reference", tags=["reference"])


@router.get("/trimestres")
def get_trimestres(
    year: int = Query(None, description="Filtrar por año"),
    db: Session = Depends(get_db)
) -> list[TrimestreOut]:
    """
    Retorna lista de trimestres.

    Parámetros:
    - year: año para filtrar (opcional)
    """
    query = db.query(Trimestre).order_by(Trimestre.anio, Trimestre.numero)

    if year:
        query = query.filter(Trimestre.anio == year)

    return query.all()


@router.get("/sprints")
def get_sprints(
    project_key: str = Query(None, description="Filtrar por proyecto"),
    estado: str = Query(None, description="Filtrar por estado: active, closed, future"),
    db: Session = Depends(get_db)
) -> list[SprintOut]:
    """
    Retorna lista de sprints.

    Parámetros:
    - project_key: proyecto para filtrar (ej. "SQP", "SQV")
    - estado: estado para filtrar (active, closed, future)
    """
    query = db.query(Sprint).order_by(Sprint.project_key, Sprint.numero)

    if project_key:
        query = query.filter(Sprint.project_key == project_key)

    if estado:
        query = query.filter(Sprint.estado == estado)

    return query.all()


@router.get("/trimestres/{quarter}")
def get_trimestre(
    quarter: str,
    db: Session = Depends(get_db)
) -> TrimestreOut:
    """Retorna un trimestre específico por su código (ej. Q2-2026)"""
    trimestre = db.query(Trimestre).filter(Trimestre.quarter == quarter).first()

    if not trimestre:
        return {"error": f"Trimestre {quarter} no encontrado"}

    return trimestre


@router.get("/sprints/{sprint_key}")
def get_sprint(
    sprint_key: str,
    db: Session = Depends(get_db)
) -> SprintOut:
    """Retorna un sprint específico por su clave (ej. SQP-Sprint-21)"""
    sprint = db.query(Sprint).filter(Sprint.sprint_key == sprint_key).first()

    if not sprint:
        return {"error": f"Sprint {sprint_key} no encontrado"}

    return sprint
