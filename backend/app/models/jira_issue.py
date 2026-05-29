import uuid
from sqlalchemy import Column, String, Integer, Text, Date, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from ..database import Base


class JiraIssue(Base):
    """
    Individual items/issues synchronized from Jira.
    Maps to existing Supabase jira_issues table schema.
    """
    __tablename__ = "jira_issues"

    # Primary identifiers
    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jira_issue_id       = Column(String, nullable=False, unique=True, index=True)  # e.g. "SVI-101"

    # Relations
    project_key         = Column(String, nullable=False, index=True)
    project_name        = Column(String, nullable=True)
    parent_issue_key    = Column(String, nullable=True)  # Parent epic/story
    parent_summary      = Column(String, nullable=True)

    # Type and description
    issue_type          = Column(String, nullable=False)  # Story, Bug, Task, Sub-task
    summary             = Column(String, nullable=False)
    description         = Column(Text, nullable=True)

    # Assignment
    assignee            = Column(String, nullable=True)  # Person name
    assignee_id         = Column(String, nullable=True)

    # Effort
    story_points        = Column(Integer, nullable=True)  # Story points/estimation

    # Status
    estado              = Column(String, nullable=True)  # Estado (In Progress, Done, To Do, etc)
    resolution          = Column(String, nullable=True)

    # Dates
    start_date          = Column(Date, nullable=True)
    due_date            = Column(Date, nullable=True)
    fecha_done          = Column(Date, nullable=True)  # When moved to Done

    # Sprint
    sprint_key          = Column(String, nullable=True, index=True)  # e.g. "SVI-Sprint-4"

    # Priority and categorization
    priority            = Column(String, nullable=True)
    labels              = Column(String, nullable=True)
    tipo_iniciativa     = Column(String, nullable=True)  # Initiative type

    # Reporting
    reporter            = Column(String, nullable=True)
    reporter_id         = Column(String, nullable=True)

    # Metadata
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Composite index for common queries
    __table_args__ = (
        Index('idx_jira_issues_project_sprint', 'project_key', 'sprint_key'),
    )
