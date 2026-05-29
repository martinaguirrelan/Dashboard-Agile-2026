"""
Capacity Supabase Service — Query jira_issues from Supabase

Fetches synchronized Jira issues and transforms them
into the JiraIssue format used by capacity dashboard computations.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.jira_issue import JiraIssue as JiraIssueModel
from ..services.capacity_sync_service import JiraIssue


class CapacitySupabaseService:
    """Service for querying Jira issues from Supabase for capacity dashboard"""

    @staticmethod
    def get_issues_by_project_and_sprint(
        db: Session,
        project_key: str,
        sprint_key: Optional[str] = None,
    ) -> List[JiraIssue]:
        """
        Query jira_issues from Supabase and convert to capacity dashboard format

        Args:
            db: SQLAlchemy session
            project_key: Jira project key (e.g. "SVI")
            sprint_key: Optional sprint key to filter by (e.g. "SVI-Sprint-4")

        Returns:
            List of JiraIssue objects in capacity dashboard format
        """
        # Build query
        query = db.query(JiraIssueModel).filter(
            JiraIssueModel.project_key == project_key
        )

        # Filter by sprint if provided
        if sprint_key is not None:
            query = query.filter(JiraIssueModel.sprint_key == sprint_key)

        # Execute query
        db_issues = query.all()

        # Transform to JiraIssue format
        issues = [
            CapacitySupabaseService._db_issue_to_capacity_issue(db_issue)
            for db_issue in db_issues
        ]

        return issues

    @staticmethod
    def get_issues_by_filters(
        db: Session,
        project_key: str,
        sprint_key: Optional[str] = None,
        assignee: Optional[str] = None,
        estado: Optional[str] = None,
        parent_issue_key: Optional[str] = None,
    ) -> List[JiraIssue]:
        """
        Query jira_issues with multiple filter options

        Args:
            db: SQLAlchemy session
            project_key: Jira project key
            sprint_key: Optional sprint key
            assignee: Optional assignee name
            estado: Optional status filter
            parent_issue_key: Optional parent issue filter

        Returns:
            List of JiraIssue objects matching filters
        """
        filters = [JiraIssueModel.project_key == project_key]

        if sprint_key is not None:
            filters.append(JiraIssueModel.sprint_key == sprint_key)

        if assignee is not None:
            filters.append(JiraIssueModel.assignee == assignee)

        if estado is not None:
            filters.append(JiraIssueModel.estado == estado)

        if parent_issue_key is not None:
            filters.append(JiraIssueModel.parent_issue_key == parent_issue_key)

        db_issues = db.query(JiraIssueModel).filter(and_(*filters)).all()

        return [
            CapacitySupabaseService._db_issue_to_capacity_issue(db_issue)
            for db_issue in db_issues
        ]

    @staticmethod
    def get_all_project_issues(db: Session, project_key: str) -> List[JiraIssue]:
        """
        Get all issues for a project (all sprints)

        Args:
            db: SQLAlchemy session
            project_key: Jira project key

        Returns:
            All JiraIssue objects for the project
        """
        db_issues = db.query(JiraIssueModel).filter(
            JiraIssueModel.project_key == project_key
        ).all()

        return [
            CapacitySupabaseService._db_issue_to_capacity_issue(db_issue)
            for db_issue in db_issues
        ]

    @staticmethod
    def _db_issue_to_capacity_issue(db_issue: JiraIssueModel) -> JiraIssue:
        """
        Convert database JiraIssue record to capacity dashboard JiraIssue format

        Maps database columns to capacity dashboard object attributes:
        - jira_issue_id → k (key)
        - issue_type → t (tipo)
        - summary → r (resumen)
        - story_points → e (esfuerzo)
        - estado → s (estado)
        - assignee → a (assignee)
        - parent_issue_key → pk (parent key)
        - tipo_iniciativa → ini (iniciativa)
        - sprint_key → sp (sprints list)
        - start_date → sd
        - due_date → due
        - fecha_done → fd

        Args:
            db_issue: Database JiraIssueModel record

        Returns:
            JiraIssue object formatted for capacity dashboard
        """
        issue = JiraIssue()
        issue.k = db_issue.jira_issue_id
        issue.t = db_issue.issue_type
        issue.r = db_issue.summary
        issue.s = db_issue.estado
        issue.a = db_issue.assignee
        issue.pk = db_issue.parent_issue_key
        issue.ek = db_issue.parent_issue_key  # Use parent_issue_key as epic
        issue.ini = db_issue.tipo_iniciativa
        issue.e = db_issue.story_points

        # Sprints: wrap sprint_key in list
        if db_issue.sprint_key is not None:
            issue.sp = [db_issue.sprint_key]
        else:
            issue.sp = []

        # Dates: convert to strings if not None
        issue.sd = db_issue.start_date.isoformat() if db_issue.start_date else None
        issue.due = db_issue.due_date.isoformat() if db_issue.due_date else None
        issue.fd = db_issue.fecha_done.isoformat() if db_issue.fecha_done else None

        return issue

    @staticmethod
    def get_issues_by_assignee(
        db: Session,
        project_key: str,
        assignee: str,
    ) -> List[JiraIssue]:
        """
        Get all issues assigned to a specific person

        Args:
            db: SQLAlchemy session
            project_key: Jira project key
            assignee: Name of assignee

        Returns:
            List of JiraIssue objects for assignee
        """
        db_issues = db.query(JiraIssueModel).filter(
            and_(
                JiraIssueModel.project_key == project_key,
                JiraIssueModel.assignee == assignee,
            )
        ).all()

        return [
            CapacitySupabaseService._db_issue_to_capacity_issue(db_issue)
            for db_issue in db_issues
        ]

    @staticmethod
    def get_sprint_summary(
        db: Session,
        project_key: str,
        sprint_key: str,
    ) -> Dict[str, Any]:
        """
        Get summary statistics for a sprint

        Args:
            db: SQLAlchemy session
            project_key: Jira project key
            sprint_key: Sprint key (e.g. "SVI-Sprint-4")

        Returns:
            Dictionary with sprint statistics
        """
        db_issues = db.query(JiraIssueModel).filter(
            and_(
                JiraIssueModel.project_key == project_key,
                JiraIssueModel.sprint_key == sprint_key,
            )
        ).all()

        issues = [
            CapacitySupabaseService._db_issue_to_capacity_issue(db_issue)
            for db_issue in db_issues
        ]

        completed = sum(1 for i in issues if i.s == "TERMINADO")
        in_progress = sum(1 for i in issues if i.s == "EN PROCESO")
        blocked = sum(1 for i in issues if i.s == "BLOQUEADOS")
        total_effort = sum(i.e or 0 for i in issues)
        assignees = list(set(i.a for i in issues if i.a))

        return {
            "total_items": len(issues),
            "completed_items": completed,
            "in_progress_items": in_progress,
            "blocked_items": blocked,
            "pending_items": len(issues) - completed,
            "total_estimation": total_effort,
            "assignees": assignees,
        }
