"""
Métricas del Dashboard Agile
- Épica 3: Matriz VP × T-Shirt Size (IMPLEMENTADA)
- Épica 1: Lead Time por Sprint (Preparada - necesita tabla sprints)
- Épica 2: Iniciativas Agregadas (Preparada - necesita tabla trimestres)
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models.jira_epic import ConfigProject, JiraEpic

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/capacidad-vp")
def get_capacidad_por_vp(
    quarter: str = Query("Q2-2026"),
    db: Session = Depends(get_db)
):
    """
    ÉPICA 3: Matriz de Distribución de Tamaños por VP.

    Retorna para cada VP:
    - Cantidad de iniciativas por tamaño (S, M, L, XL)
    - Total y formato legible (ej: "MDA (2L, 1M)")

    Parámetros:
    - quarter: Trimestre a filtrar (default: Q2-2026)
    """
    try:
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

            datos["formato"] = f"{vp} ({', '.join(partes)})" if partes else f"{vp} (vacío)"

        return list(vp_dict.values())

    except Exception as e:
        return {"error": f"Query failed: {str(e)}", "quarter": quarter}


@router.get("/matriz-vp-tshirt")
def get_matriz_vp_tshirt(
    quarter: str = Query("Q2-2026"),
    db: Session = Depends(get_db)
):
    """
    ÉPICA 3: Matriz sin procesar (VP × T-Shirt).

    Retorna datos crudos para gráficos o análisis personalizados.
    Estructura: {vp, tamanio, cantidad}
    """
    try:
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
            {"vp": vp, "tamanio": tamanio, "cantidad": cantidad}
            for vp, tamanio, cantidad in resultado
        ]
    except Exception as e:
        return {"error": f"Query failed: {str(e)}", "quarter": quarter}


@router.get("/lead-time-sprint")
def get_lead_time_by_sprint(
    sprint_key: str = Query(None, description="Filtrar por sprint (ej. SQP-Sprint-23)"),
    project_key: str = Query(None, description="Filtrar por proyecto"),
    quarter: str = Query("Q2-2026", description="Filtrar por trimestre"),
    db: Session = Depends(get_db)
):
    """
    ÉPICA 1: Lead Time por Sprint.

    Retorna estadísticas de lead time para épicas completadas en sprint(s).

    Estructura:
    - sprint_key: clave del sprint
    - sprint_name: nombre del sprint
    - epics_count: cantidad de épicas completadas
    - avg_lead_time_days: promedio de días (start_date a fecha_done)
    - min_lead_time_days: mínimo
    - max_lead_time_days: máximo
    - epics_completed: cantidad completadas (status=Done y fecha_done NOT NULL)

    Parámetros:
    - sprint_key: filtrar por sprint específico (opcional)
    - project_key: filtrar por proyecto (optional)
    - quarter: trimestre para contexto (default: Q2-2026)
    """
    try:
        from sqlalchemy import and_, cast
        from datetime import datetime

        # Query base: épicas completadas con lead_time calculado
        query = db.query(
            JiraEpic.sprint_fin.label("sprint_key"),
            JiraEpic.sprint_inicio.label("sprint_name"),  # placeholder, se buscaría en sprints table
            func.count(JiraEpic.id).label("epics_completed"),
            func.avg(JiraEpic.lead_time_days).label("avg_lead_time_days"),
            func.min(JiraEpic.lead_time_days).label("min_lead_time_days"),
            func.max(JiraEpic.lead_time_days).label("max_lead_time_days"),
        ).filter(
            JiraEpic.status == "Done",
            JiraEpic.fecha_done.isnot(None),
            JiraEpic.sprint_fin.isnot(None),
            JiraEpic.quarter == quarter,
        )

        if sprint_key:
            query = query.filter(JiraEpic.sprint_fin == sprint_key)

        if project_key:
            query = query.filter(JiraEpic.project_key == project_key)

        result = query.group_by(
            JiraEpic.sprint_fin,
            JiraEpic.sprint_inicio
        ).order_by(
            JiraEpic.sprint_fin
        ).all()

        # Formatear respuesta
        return [
            {
                "sprint_key": r[0],
                "sprint_name": r[1] or "Unknown",
                "epics_completed": r[2],
                "avg_lead_time_days": round(r[3], 2) if r[3] else None,
                "min_lead_time_days": r[4],
                "max_lead_time_days": r[5],
            }
            for r in result
        ]
    except Exception as e:
        return {"error": f"Query failed: {str(e)}", "sprint_key": sprint_key}


@router.get("/scope-creep")
def get_scope_creep_by_quarter(
    quarter: str = Query("Q2-2026", description="Trimestre a analizar"),
    db: Session = Depends(get_db)
):
    """
    ÉPICA 2: Iniciativas Agregadas - Scope Creep Analysis.

    Retorna análisis de variación de tamaño (estimacion_inicial vs estimacion_final)
    agregado por VP y trimestre.

    Estructura por VP:
    - vp: nombre del VP
    - total_initiatives: cantidad de iniciativas
    - initiatives_with_estimation: iniciativas con ambas estimaciones
    - baseline_size_total: suma de estimacion_inicial
    - final_size_total: suma de estimacion_final
    - scope_creep_percentage: (final - baseline) / baseline * 100
    - scope_creep_status: "within_bounds" (<10%), "moderate" (10-20%), "exceeded" (>20%)

    Parámetros:
    - quarter: trimestre para analizar (default: Q2-2026)
    """
    try:
        from sqlalchemy import case

        # Mapeo de T-shirt sizes a números (para agregación)
        def tshirt_to_number(size):
            mapping = {"S": 1, "M": 2, "L": 3, "XL": 4}
            return mapping.get(size.upper() if size else "S", 1)

        # Query: agrupar por VP y calcular tamaños
        resultado = db.query(
            ConfigProject.vp.label("vp"),
            func.count(JiraEpic.id).label("total_initiatives"),
            func.count(
                case((
                    (JiraEpic.estimacion_inicial.isnot(None)) &
                    (JiraEpic.estimacion_final.isnot(None)),
                    1
                ))
            ).label("initiatives_with_estimation"),
        ).join(
            JiraEpic, JiraEpic.project_key == ConfigProject.project_key
        ).filter(
            JiraEpic.quarter == quarter,
            ConfigProject.vp.isnot(None),
        ).group_by(
            ConfigProject.vp
        ).order_by(
            ConfigProject.vp
        ).all()

        # Procesar resultados
        response = []
        for vp, total_count, with_estimation in resultado:
            # Obtener épicas de este VP para calcular tamaños
            epics = db.query(JiraEpic).join(
                ConfigProject, ConfigProject.project_key == JiraEpic.project_key
            ).filter(
                ConfigProject.vp == vp,
                JiraEpic.quarter == quarter,
            ).all()

            # Calcular tamaños baseline y final (usando conteo de T-shirts)
            baseline_count = final_count = 0
            for epic in epics:
                if epic.estimacion_inicial:
                    baseline_count += tshirt_to_number(epic.estimacion_inicial)
                if epic.estimacion_final:
                    final_count += tshirt_to_number(epic.estimacion_final)

            # Calcular scope creep
            if baseline_count > 0:
                scope_creep_pct = ((final_count - baseline_count) / baseline_count) * 100
            else:
                scope_creep_pct = 0

            # Determinar status
            if scope_creep_pct < 10:
                status = "within_bounds"
            elif scope_creep_pct < 20:
                status = "moderate"
            else:
                status = "exceeded"

            response.append({
                "vp": vp,
                "total_initiatives": total_count,
                "initiatives_with_estimation": with_estimation,
                "baseline_size_total": baseline_count,
                "final_size_total": final_count,
                "scope_creep_percentage": round(scope_creep_pct, 2),
                "scope_creep_status": status,
            })

        return response
    except Exception as e:
        return {"error": f"Query failed: {str(e)}", "quarter": quarter}
