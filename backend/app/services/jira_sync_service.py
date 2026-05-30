"""
Jira Sync Service — Fetch issues from Jira Cloud and sync to Supabase

Handles full and differential syncs with error handling and logging.
"""

import httpx
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from ..models.jira_issue import JiraIssue
from ..config import settings
from ..schemas.jira_issue import JiraIssueIn

logger = logging.getLogger(__name__)


class JiraSyncService:
    """Service for syncing Jira issues to Supabase"""

    JQL_QUERY = "project = {project_key} AND type in (Task, Bug, Story, Sub-task) ORDER BY updated DESC"

    @staticmethod
    def _get_jira_headers() -> Dict[str, str]:
        """Get authorization headers for Jira API"""
        import base64
        credentials = f"{settings.jira_user_email}:{settings.jira_api_token}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return {
            "Authorization": f"Basic {encoded}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _parse_date_from_datetime(value: Optional[str]) -> Optional[str]:
        """Parse date from datetime string (2026-05-28T19:00:19.322-0500 -> 2026-05-28)"""
        if not value:
            return None
        if isinstance(value, str) and 'T' in value:
            return value.split('T')[0]
        return value

    @staticmethod
    def _parse_jira_issue(issue: Dict[str, Any], project_key: str) -> JiraIssueIn:
        """Transform Jira API response to JiraIssueIn schema"""
        fields = issue.get("fields", {})

        # Basic fields
        key = issue.get("key")
        summary = fields.get("summary")
        issue_type = fields.get("issuetype", {}).get("name") if fields.get("issuetype") else None

        # Assignee
        assignee = None
        assignee_id = None
        if fields.get("assignee"):
            assignee = fields["assignee"].get("displayName")
            assignee_id = fields["assignee"].get("accountId")

        # Status
        status = fields.get("status", {}).get("name") if fields.get("status") else None
        estado = JiraSyncService._normalize_status(status)

        # Dates - Parse from datetime strings
        created = fields.get("created")
        start_date = JiraSyncService._parse_date_from_datetime(created)

        duedate = fields.get("duedate")
        due_date = JiraSyncService._parse_date_from_datetime(duedate)

        updated = fields.get("updated")
        fecha_done = None
        if estado == "TERMINADO":
            fecha_done = JiraSyncService._parse_date_from_datetime(updated)

        # Other fields
        priority = fields.get("priority", {}).get("name") if fields.get("priority") else None
        labels = fields.get("labels", [])
        labels_str = ",".join(labels) if labels else None
        resolution = fields.get("resolution", {}).get("name") if fields.get("resolution") else None

        # Sprint — customfield_10020 es el campo estándar de sprint en Jira Software
        import re
        sprint_key = None
        sprint_field = fields.get("customfield_10020")
        if sprint_field and isinstance(sprint_field, list) and sprint_field:
            # Tomar el sprint más reciente (último)
            sprint_obj = sprint_field[-1]
            if isinstance(sprint_obj, dict):
                sprint_name = sprint_obj.get("name", "")
                # Extraer número: "Sprint 4", "SVI Sprint 4", "Sprint Q2-4" -> "4"
                match = re.search(r'(\d+)\s*$', sprint_name.strip())
                if match:
                    sprint_key = f"{project_key}-Sprint-{match.group(1)}"

        # Parent issue
        parent = fields.get("parent")
        parent_issue_key = parent.get("key") if parent else None
        parent_summary = (parent.get("fields") or {}).get("summary") if parent else None

        return JiraIssueIn(
            jira_issue_id=key,
            project_key=project_key,
            project_name=None,
            issue_type=issue_type,
            summary=summary,
            parent_issue_key=parent_issue_key,
            parent_summary=parent_summary,
            assignee=assignee,
            assignee_id=assignee_id,
            story_points=None,
            estado=estado,
            resolution=resolution,
            start_date=start_date,
            due_date=due_date,
            fecha_done=fecha_done,
            sprint_key=sprint_key,
            priority=priority,
            labels=labels_str,
            tipo_iniciativa=None,
            reporter=None,
            reporter_id=None,
        )

    @staticmethod
    def _normalize_status(status: Optional[str]) -> Optional[str]:
        """Normalize Jira status to Supabase estado field"""
        if not status:
            return None

        status_lower = status.lower()
        status_map = {
            "done": "TERMINADO",
            "closed": "TERMINADO",
            "in progress": "EN PROCESO",
            "to do": "POR INICIAR",
            "blocked": "BLOQUEADOS",
        }

        for key, value in status_map.items():
            if key in status_lower:
                return value

        return status

    @staticmethod
    async def fetch_jira_issues(
        project_key: str,
        next_page_token: Optional[str] = None,
        max_results: int = 50,
    ) -> tuple:
        """Fetch issues from Jira API usando cursor-based pagination (nextPageToken)."""
        jql = JiraSyncService.JQL_QUERY.format(project_key=project_key)
        url = f"{settings.jira_url}/rest/api/3/search/jql"

        body = {
            "jql": jql,
            "maxResults": max_results,
            "fields": ["key", "issuetype", "summary", "assignee", "status", "priority",
                       "labels", "duedate", "created", "updated", "resolution",
                       "customfield_10020", "parent"]
        }
        # nextPageToken va como query param (no en el body) — Jira API v3
        query_params = {}
        if next_page_token:
            query_params["nextPageToken"] = next_page_token

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    url,
                    json=body,
                    params=query_params,
                    headers=JiraSyncService._get_jira_headers(),
                )
                response.raise_for_status()
                data = response.json()
                issues = data.get("issues", [])
                is_last = data.get("isLast", True)
                next_token = data.get("nextPageToken")
                return issues, is_last, next_token
            except httpx.HTTPError as e:
                logger.error(f"❌ Jira API error: {e}")
                raise

    @staticmethod
    def sync_issues_to_supabase(
        db: Session,
        project_key: str,
        issues: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Sync fetched Jira issues to Supabase"""
        total_processed = len(issues)
        total_upserted = 0
        total_errors = 0

        first_error = None
        for issue in issues:
            try:
                issue_data = JiraSyncService._parse_jira_issue(issue, project_key)
                existing = db.query(JiraIssue).filter(
                    JiraIssue.jira_issue_id == issue_data.jira_issue_id
                ).first()

                if existing:
                    for key, value in issue_data.model_dump(exclude_unset=True).items():
                        if value is not None:
                            setattr(existing, key, value)
                    existing.updated_at = datetime.now()
                    db.add(existing)
                else:
                    new_issue = JiraIssue(**issue_data.model_dump())
                    db.add(new_issue)

                total_upserted += 1

            except Exception as e:
                import traceback
                err_msg = f"{type(e).__name__}: {e}"
                if first_error is None:
                    first_error = err_msg
                logger.error(f"❌ Error processing issue {issue.get('key')}: {err_msg}\n{traceback.format_exc()}")
                total_errors += 1
                db.rollback()  # reset session after each error
                continue

        try:
            db.commit()
            logger.info(f"✅ Synced {total_upserted} issues to Supabase")
        except Exception as e:
            import traceback
            commit_error = f"COMMIT {type(e).__name__}: {e}\n{traceback.format_exc()}"
            logger.error(f"❌ Error committing to Supabase: {commit_error}")
            if first_error is None:
                first_error = commit_error
            db.rollback()
            total_errors += total_upserted
            total_upserted = 0

        return {
            "total_processed": total_processed,
            "total_upserted": total_upserted,
            "total_errors": total_errors,
            "first_error": first_error,
        }

    @staticmethod
    async def run_full_sync(
        db: Session,
        project_key: str,
    ) -> Dict[str, Any]:
        """Run full sync for a project"""
        logger.info(f"🔄 Starting full sync for project {project_key}")

        start_time = datetime.now()
        total_processed = 0
        total_upserted = 0
        total_errors = 0

        try:
            next_page_token = None
            page_num = 0
            max_results = 50

            while True:
                page_num += 1
                issues, is_last, next_page_token = await JiraSyncService.fetch_jira_issues(
                    project_key,
                    next_page_token=next_page_token,
                    max_results=max_results,
                )

                if not issues:
                    break

                result = JiraSyncService.sync_issues_to_supabase(
                    db,
                    project_key,
                    issues,
                )

                total_processed += result["total_processed"]
                total_upserted += result["total_upserted"]
                total_errors += result["total_errors"]

                logger.info(f"  📄 Página {page_num}: {len(issues)} issues (isLast={is_last})")

                if is_last or not next_page_token:
                    break

            duration = (datetime.now() - start_time).total_seconds()

            logger.info(
                f"✅ Full sync complete for {project_key}: "
                f"{total_upserted} upserted, {total_errors} errors in {duration:.1f}s"
            )

            return {
                "project_key": project_key,
                "sync_type": "FULL",
                "total_processed": total_processed,
                "total_upserted": total_upserted,
                "total_errors": total_errors,
                "started_at": start_time,
                "completed_at": datetime.now(),
                "status": "success" if total_errors == 0 else "partial_error",
            }

        except Exception as e:
            import traceback
            err_detail = f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
            logger.error(f"❌ Full sync failed for {project_key}: {err_detail}")
            return {
                "project_key": project_key,
                "sync_type": "FULL",
                "total_processed": total_processed,
                "total_upserted": total_upserted,
                "total_errors": total_errors + 1,
                "started_at": start_time,
                "completed_at": datetime.now(),
                "status": "failed",
                "first_error": err_detail,
                "error": err_detail,
            }

    @staticmethod
    async def run_differential_sync(
        db: Session,
        project_key: str,
        hours: int = 1,
    ) -> Dict[str, Any]:
        """Run differential sync (only recently modified issues)"""
        logger.info(f"🔄 Starting differential sync for project {project_key} (last {hours}h)")

        start_time = datetime.now()

        try:
            from_time = datetime.now().timestamp() - (hours * 3600)
            updated_gte = datetime.fromtimestamp(from_time).isoformat()

            jql = (
                f"project = {project_key} "
                f"AND type in (Task, Bug, Story, Sub-task) "
                f"AND updated >= {updated_gte} "
                f"ORDER BY updated DESC"
            )

            url = f"{settings.jira_url}/rest/api/3/search/jql"

            params = {
                "jql": jql,
                "maxResults": 100,
                "fields": ["key", "issuetype", "summary", "assignee", "status", "priority", "labels", "duedate", "created", "updated", "resolution", "customfield_10020", "parent"]
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    json=params,
                    headers=JiraSyncService._get_jira_headers(),
                )
                response.raise_for_status()
                data = response.json()
                issues = data.get("issues", [])

            result = JiraSyncService.sync_issues_to_supabase(
                db,
                project_key,
                issues,
            )

            duration = (datetime.now() - start_time).total_seconds()

            logger.info(
                f"✅ Differential sync complete for {project_key}: "
                f"{result['total_upserted']} upserted in {duration:.1f}s"
            )

            return {
                "project_key": project_key,
                "sync_type": "DIFERENCIAL",
                "total_processed": result["total_processed"],
                "total_upserted": result["total_upserted"],
                "total_errors": result["total_errors"],
                "started_at": start_time,
                "completed_at": datetime.now(),
                "status": "success" if result["total_errors"] == 0 else "partial_error",
            }

        except Exception as e:
            logger.error(f"❌ Differential sync failed for {project_key}: {e}")
            return {
                "project_key": project_key,
                "sync_type": "DIFERENCIAL",
                "total_processed": 0,
                "total_upserted": 0,
                "total_errors": 1,
                "started_at": start_time,
                "completed_at": datetime.now(),
                "status": "failed",
                "error": str(e),
            }
