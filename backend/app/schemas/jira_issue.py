from __future__ import annotations
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel


class JiraIssueOut(BaseModel):
    """Response schema for JiraIssue - maps to existing Supabase table"""
    id: UUID
    jira_issue_id: str
    project_key: str
    project_name: str | None
    issue_type: str
    summary: str
    parent_issue_key: str | None
    parent_summary: str | None
    assignee: str | None
    assignee_id: str | None
    story_points: int | None
    estado: str | None
    resolution: str | None
    start_date: date | None
    due_date: date | None
    fecha_done: date | None
    sprint_key: str | None
    priority: str | None
    labels: str | None
    tipo_iniciativa: str | None
    reporter: str | None
    reporter_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JiraIssueIn(BaseModel):
    """Request schema for creating/updating JiraIssue"""
    jira_issue_id: str
    project_key: str
    project_name: str | None = None
    issue_type: str
    summary: str
    parent_issue_key: str | None = None
    parent_summary: str | None = None
    assignee: str | None = None
    assignee_id: str | None = None
    story_points: int | None = None
    estado: str | None = None
    resolution: str | None = None
    start_date: date | None = None
    due_date: date | None = None
    fecha_done: date | None = None
    sprint_key: str | None = None
    priority: str | None = None
    labels: str | None = None
    tipo_iniciativa: str | None = None
    reporter: str | None = None
    reporter_id: str | None = None


class JiraIssueBulk(BaseModel):
    """For bulk upsert operations during Jira sync"""
    items: list[JiraIssueIn]


class JiraIssueCapacityRow(BaseModel):
    """Capacity dashboard format (for internal use)"""
    k: str  # jira_issue_id
    t: str  # issue_type
    r: str  # summary
    e: int | None  # story_points (effort)
    s: str | None  # estado (status)
    a: str | None  # assignee
    pk: str | None  # parent_issue_key
    sp: list[str] = []  # [sprint_key]
    sd: date | None  # start_date
    due: date | None  # due_date
    fd: date | None  # fecha_done
    ini: str | None  # tipo_iniciativa


class JiraIssueFilterRequest(BaseModel):
    """For filtering issues in capacity queries"""
    project_key: str | None = None
    assignee: str | None = None
    estado: str | None = None
    sprint_key: str | None = None
    parent_issue_key: str | None = None
    tipo_iniciativa: str | None = None


class JiraIssueSyncStats(BaseModel):
    """Statistics from a sync operation"""
    total_processed: int
    total_upserted: int
    total_errors: int
    sync_type: str
    started_at: datetime
    completed_at: datetime | None
    status: str
