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
