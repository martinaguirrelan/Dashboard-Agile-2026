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
# Load CSV data from project root for testing

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
        if not csv_data:
            raise HTTPException(
                status_code=404,
                detail=f"No data found for project {projectKey}. Please load CSV or sync from Jira.",
            )

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
