"""
Métricas del Dashboard Agile - Épicas 1, 2, 3
- Épica 3: Matriz VP × T-Shirt Size
- Épica 1: Lead Time por Sprint (preparado)
- Épica 2: Iniciativas Agregadas (preparado)
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone, date
from sqlalchemy import func

from ..database import get_db
from ..models.jira_epic import ConfigProject, JiraEpic, Trimestre, Sprint
from ..schemas.jira_epic import MatrizVPTShirt, CapacidadVPOut

router = APIRouter(prefix="/metrics", tags=["metrics"])


# ============================================================
# ÉPICA 3: Matriz VP × T-Shirt Size
# ============================================================

@router.get("/capacidad-vp", response_model=list[CapacidadVPOut])
def get_capacidad_por_vp(
    quarter: str = Query("Q2-2026"),
    db: Session = Depends(get_db)
):
    """
    Matriz de Distribución de Tamaños por VP.

    Retorna para cada VP:
    - Cantidad de iniciativas por tamaño (S, M, L, XL)
    - Total y formato legible
    """
    # Query: agrupar por VP y T-shirt size
    resultado = db.query(
        ConfigProject.vp.label("vp"),
        JiraEpic.estimacion_inicial.label("tamanio"),
        func.count(JiraEpic.id).label("cantidad")
    ).join(
        JiraEpic, JiraEpic.project_key == ConfigProject.project_key
    ).filter(
        JiraEpic.quarter == quarter,
        ConfigProject.vp.isnot(None)
    ).group_by(
        ConfigProject.vp,
        JiraEpic.estimacion_inicial
    ).order_by(
        ConfigProject.vp,
        JiraEpic.estimacion_inicial
    ).all()

    # Procesar resultados en diccionario por VP
    vp_dict = {}
    for vp, tamanio, cantidad in resultado:
        if vp not in vp_dict:
            vp_dict[vp] = {
                "vp": vp,
                "iniciativas_s": 0,
                "iniciativas_m": 0,
                "iniciativas_l": 0,
                "iniciativas_xl": 0,
                "total": 0,
                "formato": ""
            }

        if tamanio and tamanio.upper() == "S":
            vp_dict[vp]["iniciativas_s"] = cantidad
        elif tamanio and tamanio.upper() == "M":
            vp_dict[vp]["iniciativas_m"] = cantidad
        elif tamanio and tamanio.upper() == "L":
            vp_dict[vp]["iniciativas_l"] = cantidad
        elif tamanio and tamanio.upper() == "XL":
            vp_dict[vp]["iniciativas_xl"] = cantidad

        vp_dict[vp]["total"] += cantidad

    # Generar formato legible
    for vp, datos in vp_dict.items():
        partes = []
        if datos["iniciativas_xl"] > 0:
            partes.append(f"{datos['iniciativas_xl']}XL")
        if datos["iniciativas_l"] > 0:
            partes.append(f"{datos['iniciativas_l']}L")
        if datos["iniciativas_m"] > 0:
            partes.append(f"{datos['iniciativas_m']}M")
        if datos["iniciativas_s"] > 0:
            partes.append(f"{datos['iniciativas_s']}S")

        datos["formato"] = f"{vp} ({', '.join(partes)})" if partes else f"{vp} (0)"

    return [CapacidadVPOut(**v) for v in vp_dict.values()]


@router.get("/matriz-vp-tshirt", response_model=list[MatrizVPTShirt])
def get_matriz_vp_tshirt(
    quarter: str = Query("Q2-2026"),
    db: Session = Depends(get_db)
):
    """
    Matriz sin procesar: VP × T-Shirt con cantidades.
    Útil para gráficos o análisis personalizados.
    """
    resultado = db.query(
        ConfigProject.vp.label("vp"),
        JiraEpic.estimacion_inicial.label("tamanio"),
        func.count(JiraEpic.id).label("cantidad")
    ).join(
        JiraEpic, JiraEpic.project_key == ConfigProject.project_key
    ).filter(
        JiraEpic.quarter == quarter,
        ConfigProject.vp.isnot(None)
    ).group_by(
        ConfigProject.vp,
        JiraEpic.estimacion_inicial
    ).order_by(
        ConfigProject.vp,
        JiraEpic.estimacion_inicial
    ).all()

    return [
        MatrizVPTShirt(vp=vp, tamanio=tamanio, cantidad=cantidad)
        for vp, tamanio, cantidad in resultado
    ]


# ============================================================
# ÉPICA 1: Lead Time por Sprint (En construcción)
# ============================================================

@router.get("/lead-time-sprint")
def get_lead_time_por_sprint(
    project_key: str = Query("PM"),
    quarter: str = Query("Q2-2026"),
    db: Session = Depends(get_db)
):
    """
    Lead Time agrupado por Sprint.
    PRÓXIMAMENTE: Integración con tabla Sprints.
    """
    # Query preparada para cuando se agreguen sprints
    resultado = db.query(
        JiraEpic.sprint_inicio.label("sprint"),
        func.avg(JiraEpic.lead_time_days).label("promedio_lead_time"),
        func.count(JiraEpic.id).label("cantidad_epicas"),
        func.min(JiraEpic.lead_time_days).label("min"),
        func.max(JiraEpic.lead_time_days).label("max")
    ).filter(
        JiraEpic.project_key == project_key,
        JiraEpic.quarter == quarter,
        JiraEpic.lead_time_days.isnot(None),
        JiraEpic.sprint_inicio.isnot(None)
    ).group_by(
        JiraEpic.sprint_inicio
    ).order_by(
        JiraEpic.sprint_inicio
    ).all()

    return [
        {
            "sprint": sprint,
            "promedio_lead_time": round(float(avg), 2) if avg else None,
            "cantidad_epicas": cantidad,
            "min_lead_time": min_lt,
            "max_lead_time": max_lt
        }
        for sprint, avg, cantidad, min_lt, max_lt in resultado
    ]


# ============================================================
# ÉPICA 2: Iniciativas Agregadas (En construcción)
# ============================================================

@router.get("/iniciativas-agregadas")
def get_iniciativas_agregadas(
    quarter: str = Query("Q2-2026"),
    db: Session = Depends(get_db)
):
    """
    Iniciativas que ingresaron después del inicio del trimestre.
    PRÓXIMAMENTE: Validación con tabla trimestres.

    Fórmula: % agregadas = (I_agregadas / I_inicial) × 100
    """
    # Obtener trimestre para obtener fecha de inicio
    trimestre = db.query(Trimestre).filter(
        Trimestre.quarter == quarter
    ).first()

    if not trimestre:
        return {
            "error": f"Trimestre {quarter} no encontrado"
        }

    # Contar épicas iniciales (creadas antes del inicio del trimestre)
    epicas_iniciales = db.query(func.count(JiraEpic.id)).filter(
        JiraEpic.quarter == quarter,
        JiraEpic.created_at < trimestre.fecha_inicio
    ).scalar() or 0

    # Contar épicas agregadas (creadas durante el trimestre)
    epicas_agregadas = db.query(func.count(JiraEpic.id)).filter(
        JiraEpic.quarter == quarter,
        JiraEpic.created_at >= trimestre.fecha_inicio
    ).scalar() or 0

    # Calcular porcentaje
    porcentaje = (epicas_agregadas / epicas_iniciales * 100) if epicas_iniciales > 0 else 0

    # Obtener listado de iniciativas agregadas
    listado = db.query(
        JiraEpic.jira_issue_id,
        JiraEpic.epic_name,
        JiraEpic.project_key,
        JiraEpic.created_at
    ).filter(
        JiraEpic.quarter == quarter,
        JiraEpic.created_at >= trimestre.fecha_inicio
    ).order_by(JiraEpic.created_at.desc()).all()

    return {
        "trimestre": quarter,
        "fecha_baseline": trimestre.fecha_inicio.isoformat(),
        "epicas_iniciales": epicas_iniciales,
        "epicas_agregadas": epicas_agregadas,
        "porcentaje_agregadas": round(porcentaje, 2),
        "iniciativas_agregadas": [
            {
                "jira_id": jira_id,
                "nombre": nombre,
                "proyecto": proyecto,
                "fecha_creacion": creacion.isoformat()
            }
            for jira_id, nombre, proyecto, creacion in listado
        ]
    }
