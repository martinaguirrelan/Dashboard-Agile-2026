"""
Capacity Dashboard API Endpoints

GET /capacity/squad/{projectKey}
  - Query: sprint (int, default: current)
  - Returns: capacity dashboard data (template-compatible format)
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from typing import Optional, Dict, Any
import json
import os
import logging

from app.services.capacity_sync_service import build_capacity_dashboard, build_capacity_dashboard_from_issues
from app.services.capacity_supabase_service import CapacitySupabaseService
from app.database import get_db
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

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
    """Get squad-specific configuration (template-compatible format)"""
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
                "Luis Inga": "soporte",
                "Natalí Tauma Caja": "dev",
                "Jessica Albino": "dev",
                "Nicolas Ricardo Mercado Maldonado": "lt",
                "Paul de la cruz": "po",
            },
            "vacaciones": {
                "Vanessa Nieto": [["2026-04-06", "2026-04-20"]],
                "Orlando Yepes": [["2026-04-04", "2026-04-11"]],
                "Junior Pezantes Silva": [["2026-04-06", "2026-04-15"]],
                "Cristian Ycochea": [["2026-04-24", "2026-04-24"], ["2026-05-25", "2026-05-29"]],
                "Luis Inga": [["2026-04-24", "2026-04-30"]],
                "Natalí Tauma Caja": [["2026-05-04", "2026-05-18"]],
                "Jessica Albino": [["2026-04-22", "2026-04-29"]],
            },
            "excluidos": [
                "Orlando Yepes",
                "Nicolas Ricardo Mercado Maldonado",
                "Paul De La Cruz",
                "Paul de la cruz",
                "Sara.perca",
                "sara.perca",
            ],
            "ltPersona": "Nicolas Ricardo Mercado Maldonado",
            "notas": {
                "Luis Inga": "Esfuerzo principal en tablero Soporte Digital",
            },
            "epicasExcluidas": [],
        },
        "SVI": {
            "squad": "SQ Vehiculos IS",
            "roles": {
                "Antonio Sebastian Sanchez Anton": "dev",
                "Jahir Moncada": "dev",
                "Marco Antonio Cruzado Cuadros": "dev",
                "Jose Ataypoma Llanto": "qa",
                "Daniel Angeles Lujan": "qa",
                "Jennie Barrientos": "qa",
                "Cristobal Urbina": "ux",
                "William Chávez": "lt",
                "Christopher Ramos": "soporte",
                "Israel Yance": "dev",
                "sara.perca": "po",
                "Paul de la cruz": "po",
            },
            "vacaciones": {
                "Marco Antonio Cruzado Cuadros": [["2026-05-04", "2026-05-11"]],
                "Christopher Ramos": [["2026-06-22", "2026-06-26"]],
                "Israel Yance": [],
            },
            "excluidos": [
                "sara.perca",
                "Paul de la cruz",
            ],
            "ltPersona": "William Chávez",
            "notas": {
                "Christopher Ramos": "Esfuerzo principal en tablero Soporte Digital",
                "Israel Yance": "Cross-squad (también SPI)",
                "William Chávez": "Líder Técnico — esfuerzo opcional vía toggle",
                "Marco Antonio Cruzado Cuadros": "Vacaciones 04/05–11/05",
            },
            "epicasExcluidas": ["SVI-7"],
        },
    }

    return configs.get(project_key.upper(), {
        "squad": project_key,
        "roles": {},
        "vacaciones": {},
        "excluidos": [],
        "ltPersona": None,
        "notas": {},
        "epicasExcluidas": [],
    })


# ============ HELPER FUNCTIONS ============

def build_sprint_config_full() -> Dict[str, Dict[str, Any]]:
    """Complete sprint configuration matching template format"""
    return {
        "1": {
            "num": 1,
            "nombre": "Sprint 1",
            "rango": "08/04 – 21/04",
            "start": "2026-04-08",
            "end": "2026-04-21",
            "diasHabiles": 10,
            "feriados": 0,
            "efectivos": 10,
            "capMaxDias": 8,
            "capMaxHoras": 64,
            "tag": "SP1-Q2",
        },
        "2": {
            "num": 2,
            "nombre": "Sprint 2",
            "rango": "22/04 – 05/05",
            "start": "2026-04-22",
            "end": "2026-05-05",
            "diasHabiles": 10,
            "feriados": 1,
            "efectivos": 9,
            "capMaxDias": 8,
            "capMaxHoras": 64,
            "tag": "Sprint 2",
        },
        "3": {
            "num": 3,
            "nombre": "Sprint 3",
            "rango": "06/05 – 19/05",
            "start": "2026-05-06",
            "end": "2026-05-19",
            "diasHabiles": 10,
            "feriados": 0,
            "efectivos": 10,
            "capMaxDias": 9,
            "capMaxHoras": 72,
            "tag": "Sprint 3",
        },
        "4": {
            "num": 4,
            "nombre": "Sprint 4",
            "rango": "20/05 – 02/06",
            "start": "2026-05-20",
            "end": "2026-06-02",
            "diasHabiles": 10,
            "feriados": 0,
            "efectivos": 10,
            "capMaxDias": 9,
            "capMaxHoras": 72,
            "tag": "Sprint 4",
        },
        "5": {
            "num": 5,
            "nombre": "Sprint 5",
            "rango": "03/06 – 16/06",
            "start": "2026-06-03",
            "end": "2026-06-16",
            "diasHabiles": 10,
            "feriados": 0,
            "efectivos": 10,
            "capMaxDias": 9,
            "capMaxHoras": 72,
            "tag": "Sprint 5",
        },
        "6": {
            "num": 6,
            "nombre": "Sprint 6",
            "rango": "17/06 – 30/06",
            "start": "2026-06-17",
            "end": "2026-06-30",
            "diasHabiles": 10,
            "feriados": 1,
            "efectivos": 9,
            "capMaxDias": 8,
            "capMaxHoras": 64,
            "tag": "Sprint 6",
        },
    }


def format_data_for_template(dashboard: Dict[str, Any], squad_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform backend response to template-compatible format

    Template expects:
    {
        "config": { squad, sprints, roles, vacaciones, excluidos, ltPersona, notas, epicasExcluidas },
        "epics": [...],
        "parents": [...],
        "items": [...],
        "computed": { team, alertas, ... }
    }
    """
    # Build complete config
    config = {
        "squad": squad_config.get("squad", ""),
        "currentSprint": 4,
        "corte": "2026-05-27",
        "quarterEnd": "2026-06-30",
        "sprints": build_sprint_config_full(),
        "vacaciones": squad_config.get("vacaciones", {}),
        "excluidos": squad_config.get("excluidos", []),
        "ltPersona": squad_config.get("ltPersona"),
        "roles": squad_config.get("roles", {}),
        "notas": squad_config.get("notas", {}),
        "epicasExcluidas": squad_config.get("epicasExcluidas", []),
    }

    return {
        "config": config,
        "epics": [],  # Will be populated from parents if needed
        "parents": dashboard.get("parents", []),
        "items": dashboard.get("items", []),
        "computed": dashboard.get("computed", {}),  # Include computed metrics from dashboard
    }


# ============ ENDPOINTS ============

@router.get("/squad/{projectKey}")
async def get_squad_capacity(
    projectKey: str,
    sprint: Optional[int] = Query(None, description="Sprint number (default: current)"),
    db: Session = Depends(get_db),
):
    """
    Get capacity dashboard for a squad (Template-compatible format)

    Data source priority:
    1. Supabase jira_issues table (synced from Jira)
    2. CSV file (legacy)
    3. Mock data (fallback)
    """
    try:
        # Determine sprint (default to 4)
        if sprint is None:
            sprint = 4

        sprint_key = f"{projectKey}-Sprint-{sprint}"
        squad_config = get_squad_config(projectKey)
        issues_data = None
        data_source = "unknown"

        # 1. Try Supabase jira_issues
        try:
            supabase_issues = CapacitySupabaseService.get_issues_by_project_and_sprint(
                db=db,
                project_key=projectKey,
                sprint_key=sprint_key,
            )
            if supabase_issues:
                dashboard = build_capacity_dashboard_from_issues(
                    project_key=projectKey,
                    sprint_num=sprint,
                    issues=supabase_issues,
                    config_overrides={
                        "squad": squad_config.get("squad", projectKey),
                        "roles": squad_config.get("roles", {}),
                        "vacaciones": squad_config.get("vacaciones", {}),
                        "excluidos": squad_config.get("excluidos", []),
                        "notas": squad_config.get("notas", {}),
                    },
                )
                data_source = f"supabase ({len(supabase_issues)} issues)"
                logger.info(f"✅ Loaded {len(supabase_issues)} issues from Supabase for {projectKey} sprint {sprint}")
                response = format_data_for_template(dashboard, squad_config)
                return {"data": response, "source": data_source}
            else:
                logger.warning(f"⚠️ No issues in Supabase for {projectKey} / {sprint_key} — falling back to CSV")
        except Exception as e:
            logger.error(f"⚠️ Supabase query failed: {e} — falling back to CSV")

        # 2. Try CSV
        csv_data = load_csv_data(projectKey)
        if csv_data:
            data_source = "csv"
        else:
            # 3. Mock fallback
            csv_data = get_mock_data(projectKey)
            data_source = "mock"

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

        # Format for template consumption
        response = format_data_for_template(dashboard, squad_config)
        return {"data": response, "source": data_source}

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
