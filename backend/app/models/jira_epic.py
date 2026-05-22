import uuid
from sqlalchemy import Column, String, Boolean, Date, DateTime, Integer, Numeric, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from ..database import Base


class ConfigProject(Base):
    __tablename__ = "config_projects"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_key          = Column(String, nullable=False, unique=True, index=True)
    project_name         = Column(String, nullable=True)
    vp                   = Column(String, nullable=True)
    is_active            = Column(Boolean, default=True)
    last_sync_timestamp  = Column(DateTime(timezone=True), nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())


class JiraEpic(Base):
    __tablename__ = "jira_epics"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jira_issue_id    = Column(String, nullable=False, unique=True, index=True)
    epic_name        = Column(String, nullable=False)
    description      = Column(Text, nullable=True)
    start_date       = Column(DateTime(timezone=True), nullable=True)
    priority_quarter = Column(String, nullable=True)
    priority_status  = Column(String, nullable=True)
    due_date         = Column(DateTime(timezone=True), nullable=True)
    project_key      = Column(String, ForeignKey("config_projects.project_key"), nullable=False, index=True)
    lead_time_days   = Column(Integer, nullable=True)
    status              = Column(String, nullable=True)
    estado_normalizado  = Column(String, nullable=True)
    assignee            = Column(String, nullable=True)
    year             = Column(Integer, nullable=True)
    quarter          = Column(String(3), nullable=True)
    sprint_inicio      = Column(String, nullable=True)
    estimacion_inicial = Column(String, nullable=True)
    estimacion_final   = Column(String, nullable=True)
    estado_iniciativa  = Column(String, nullable=True)
    fecha_done         = Column(Date, nullable=True)
    fecha_prd          = Column(Date, nullable=True)
    sprint_fin         = Column(String, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
