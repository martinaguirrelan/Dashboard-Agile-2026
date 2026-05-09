from __future__ import annotations
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class ConfigProjectOut(BaseModel):
    id: UUID
    project_key: str
    project_name: str | None
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
    assignee: str | None
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
