"""
Capacity Dashboard API Endpoints

GET /capacity/squad/{projectKey}
  - Query: sprint (int, default: current)
  - Returns: capacity dashboard data
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Dict, Any
import json
import os

from app.services.capacity_sync_service import build_capacity_dashboard

router = APIRouter(prefix="/capacity", tags=["capacity"])

# ============ MOCK DATA (Temporary until Jira integration) ============
# Mock data for demo/testing when CSV is not available

def get_mock_data(project_key: str) -> list:
    """
    Return mock data for testing when CSV is not available.
    Used for Vercel deployment without CSV files.
    """
    return [
        {
            "Tipo de Incidencia": "Story",
            "Clave de incidencia": f"{project_key}-101",
            "Resumen": "Implementar autenticación de usuarios",
            "Estimación original": "86400",  # 24h
            "Estado": "Done",
            "Persona asignada": "Cristhian Zapata",
            "Clave principal": f"{project_key}-P1",
            "Tipo de Iniciativa": "Feature",
            "Sprint": "4",
            "Start date": "2026-05-20",
            "Fecha Done": "2026-05-25"
        },
        {
            "Tipo de Incidencia": "Story",
            "Clave de incidencia": f"{project_key}-102",
            "Resumen": "Crear dashboard de capacidad",
            "Estimación original": "129600",  # 36h
            "Estado": "In Progress",
            "Persona asignada": "Alessandra Nuñez",
            "Clave principal": f"{project_key}-P1",
            "Tipo de Iniciativa": "Feature",
            "Sprint": "4",
            "Start date": "2026-05-20",
            "Fecha Done": None
        },
        {
            "Tipo de Incidencia": "Task",
            "Clave de incidencia": f"{project_key}-103",
            "Resumen": "Documentar API",
            "Estimación original": "28800",  # 8h
            "Estado": "To Do",
            "Persona asignada": "Junior Pezantes Silva",
            "Clave principal": f"{project_key}-P1",
            "Tipo de Iniciativa": "Feature",
            "Sprint": "4",
            "Start date": "2026-05-20",
            "Fecha Done": None
        },
        {
            "Tipo de Incidencia": "Story",
            "Clave de incidencia": f"{project_key}-104",
            "Resumen": "Integración con Jira",
            "Estimación original": "172800",  # 48h
            "Estado": "In Progress",
            "Persona asignada": "Cristian Ycochea",
            "Clave principal": f"{project_key}-P2",
            "Tipo de Iniciativa": "Feature",
            "Sprint": "4",
            "Start date": "2026-05-20",
            "Fecha Done": None
        },
        {
            "Tipo de Incidencia": "Bug",
            "Clave de incidencia": f"{project_key}-105",
            "Resumen": "Corregir validación de fechas",
            "Estimación original": "14400",  # 4h
            "Estado": "Done",
            "Persona asignada": "Luis Inga",
            "Clave principal": f"{project_key}-P2",
            "Tipo de Iniciativa": "Maintenance",
            "Sprint": "4",
            "Start date": "2026-05-20",
            "Fecha Done": "2026-05-24"
        },
    ]

def load_csv_data(project_key: str) -> list:
    """
    Load CSV file for project
    Temporary: until real Jira sync
    """
    project_key_lower = project_key.lower()
    csv_paths = [
        f"/Users/martinaguirrelan/Desktop/Archivos_Dashboard 2026/Datos_SQ{project_key} IS_2505_v2.csv",
        f"./data/Datos_SQ{project_key} IS_2505_v2.csv",
    ]

    for path in csv_paths:
        if os.path.exists(path):
            import csv

            rows = []
            try:
                with open(path, "r", encoding="utf-8-sig") as f:
                    reader = csv.DictReader(f, delimiter=";")
                    for row in reader:
                        rows.append(row)
                return rows
            except Exception as e:
                print(f"Error loading CSV {path}: {e}")
                continue

    return []


def get_squad_config(project_key: str) -> Dict[str, Any]:
    """Get squad-specific configuration"""
    configs = {
        "SPI": {
            "squad": "SQ Personas IS",
            "roles": {
                "Alessandra Nuñez": "dev",
                "Cristhian Zapata": "dev",
                "Vanessa Nieto": "qa",
                "Orlando Yepes": "dev",
                "Junior Pezantes Silva": "dev",
                "Richard Manuel Alcocer Chaparro": "dev",
                "Cristian Ycochea": "dev",
                "Luis Inga": "dev",
                "Natalí Tauma Caja": "dev",
                "Jessica Albino": "dev",
                "Nicolas Ricardo Mercado Maldonado": "lt",
                "Paul de la cruz": "po",
            },
            "vacaciones": {
                "Vanessa Nieto": [("2026-04-06", "2026-04-20")],
                "Orlando Yepes": [("2026-04-04", "2026-04-11")],
                "Junior Pezantes Silva": [("2026-04-06", "2026-04-15")],
                "Cristian Ycochea": [("2026-04-24", "2026-04-24"), ("2026-05-25", "2026-05-29")],
                "Luis Inga": [("2026-04-24", "2026-04-30")],
                "Natalí Tauma Caja": [("2026-05-04", "2026-05-18")],
                "Jessica Albino": [("2026-04-22", "2026-04-29")],
            },
            "excluidos": [
                "Orlando Yepes",
                "Nicolas Ricardo Mercado Maldonado",
                "Paul De La Cruz",
                "Paul de la cruz",
                "Sara.perca",
                "sara.perca",
            ],
            "notas": {},
        },
        "SVI": {
            "squad": "SQ Vehiculos IS",
            "roles": {
                "Antonio Sebastian Sanchez Anton": "dev",
                "Jahir Moncada": "dev",
                "Marco Antonio Cruzado Cuadros": "ux",
                "Jose Ataypoma Llanto": "qa",
                "Sara Perca": "po",
                "Paul de la cruz": "lt",
            },
            "vacaciones": {},
            "excluidos": [],
            "notas": {},
        },
    }

    return configs.get(project_key.upper(), {"squad": project_key, "roles": {}, "vacaciones": {}, "excluidos": []})


# ============ ENDPOINTS ============

@router.get("/squad/{projectKey}")
async def get_squad_capacity(
    projectKey: str,
    sprint: Optional[int] = Query(None, description="Sprint number (default: current)"),
):
    """
    Get capacity dashboard for a squad

    Args:
        projectKey: e.g. "SPI", "SVI"
        sprint: Sprint number (optional, defaults to current)

    Returns:
        {
            config: {...},
            parents: [...],
            items: [...],
            computed: {
                team: [...],
                avancePadres: float,
                avanceHoras: float,
                alertas: [...]
            }
        }
    """
    try:
        # Load CSV data (temporary)
        csv_data = load_csv_data(projectKey)

        # Fallback to mock data if CSV not found
        if not csv_data:
            csv_data = get_mock_data(projectKey)

        # Get squad config
        squad_config = get_squad_config(projectKey)

        # Determine sprint (default to current from config)
        if sprint is None:
            sprint = 4  # Default current sprint

        # Build dashboard
        dashboard = build_capacity_dashboard(
            project_key=projectKey,
            sprint_num=sprint,
            issues_data=csv_data,
            config_overrides={
                "squad": squad_config.get("squad", projectKey),
                "roles": squad_config.get("roles", {}),
                "vacaciones": squad_config.get("vacaciones", {}),
                "excluidos": squad_config.get("excluidos", []),
                "notas": squad_config.get("notas", {}),
            },
        )

        return dashboard

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error computing capacity: {e}")
        raise HTTPException(status_code=500, detail=f"Error computing capacity: {str(e)}")


@router.get("/squad/{projectKey}/sprints")
async def get_squad_sprints(projectKey: str):
    """Get available sprints for a squad"""
    try:
        squad_config = get_squad_config(projectKey)

        return {
            "squad": squad_config.get("squad", projectKey),
            "sprints": [
                {"num": 1, "name": "Sprint 1", "rango": "08/04 – 21/04"},
                {"num": 2, "name": "Sprint 2", "rango": "22/04 – 05/05"},
                {"num": 3, "name": "Sprint 3", "rango": "06/05 – 19/05"},
                {"num": 4, "name": "Sprint 4", "rango": "20/05 – 02/06"},
                {"num": 5, "name": "Sprint 5", "rango": "03/06 – 16/06"},
                {"num": 6, "name": "Sprint 6", "rango": "17/06 – 30/06"},
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching sprints: {str(e)}")


@router.get("/squads")
async def get_available_squads():
    """Get list of available squads"""
    return {
        "squads": [
            {"key": "SPI", "name": "SQ Personas IS"},
            {"key": "SVI", "name": "SQ Vehiculos IS"},
        ],
    }
