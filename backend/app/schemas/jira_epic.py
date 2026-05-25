from __future__ import annotations
from datetime import date, datetime
from uuid import UUID
from typing import Any
from pydantic import BaseModel


class ConfigProjectOut(BaseModel):
    id: UUID
    project_key: str
    project_name: str | None
    vp: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class JiraEpicOut(BaseModel):
    id: UUID
    jira_issue_id: str
    epic_name: str
    description: str | None
    start_date: datetime | None
    priority_quarter: str | None
    priority_status: str | None
    due_date: datetime | None
    project_key: str
    lead_time_days: int | None
    status: str | None
    estado_normalizado: str | None
    assignee: str | None
    year: int | None
    quarter: str | None
    sprint_inicio:      str | None
    estimacion_inicial: str | None
    estimacion_final:   str | None
    estado_iniciativa:  str | None
    fecha_done:         date | None
    fecha_prd:          date | None
    sprint_fin:         str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SyncResultOut(BaseModel):
    status: str
    started_at: str | None = None
    duration_seconds: float | None = None
    total_upserted: int = 0
    total_errors: int = 0
    projects: list[dict] = []


class SyncLogOut(BaseModel):
    id: UUID
    sync_type: str
    started_at: datetime
    ended_at: datetime | None
    duration_seconds: float | None
    total_upserted: int | None
    total_errors: int | None
    status: str | None
    error_message: str | None
    projects_detail: Any | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SyncMetricOut(BaseModel):
    id: UUID
    date: date
    sync_count: int
    avg_duration_seconds: float | None
    total_epics_upserted: int
    total_errors: int
    error_rate: float | None
    fastest_sync_seconds: float | None
    slowest_sync_seconds: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TrimestreOut(BaseModel):
    id: UUID
    quarter: str
    anio: int
    numero: int
    fecha_inicio: date
    fecha_fin: date
    descripcion: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SprintOut(BaseModel):
    id: UUID
    sprint_key: str
    sprint_name: str
    numero: int | None
    project_key: str
    fecha_inicio: date
    fecha_fin: date
    estado: str
    descripcion: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MatrizVPTShirt(BaseModel):
    """Matriz VP × T-Shirt Size (Épica 3)"""
    vp: str | None
    tamanio: str | None
    cantidad: int


class CapacidadVPOut(BaseModel):
    """Respuesta de capacidad por VP"""
    vp: str | None
    iniciativas_s: int = 0
    iniciativas_m: int = 0
    iniciativas_l: int = 0
    iniciativas_xl: int = 0
    total: int = 0
    formato: str  # ej: "MDA (2L, 1M)"
