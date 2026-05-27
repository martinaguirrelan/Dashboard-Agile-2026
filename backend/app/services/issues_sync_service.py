"""
Módulo Capacity: Sincronización de Issues desde Jira → Supabase.
Sincroniza TODOS los tipos: Epic, Request, Subtarea, Historia, Bug, Spike.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.jira_epic import ConfigProject, JiraIssue, SyncLog
from ..config import settings
import httpx
import base64

logger = logging.getLogger(__name__)

_DIVIDER = "━" * 48


def _basic_auth_header() -> str:
    raw = f"{settings.jira_user_email}:{settings.jira_api_token}"
    return "Basic " + base64.b64encode(raw.encode()).decode()


def _headers() -> dict[str, str]:
    return {
        "Authorization": _basic_auth_header(),
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _active_project_keys(db: Session) -> list[str]:
    rows = db.query(ConfigProject.project_key).filter(ConfigProject.is_active.is_(True)).all()
    return [r[0] for r in rows]


async def fetch_issues_for_project_async(project_key: str) -> list[dict]:
    """Fetch TODOS los issues del proyecto desde Jira API."""
    try:
        jql = f"project = {project_key} ORDER BY created DESC"
        url = f"{settings.jira_base_url}/rest/api/3/search"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                params={
                    "jql": jql,
                    "maxResults": 1000,
                    "fields": (
                        "key,issuetype,summary,customfield_10017,"  # key, type, summary, story points
                        "status,assignee,priority,sprint,"
                        "parent,labels,resolution,created,updated,duedate,"
                        f"{settings.jira_field_start_date},"  # start_date
                        f"{settings.jira_field_fecha_done},"   # fecha_done
                        f"{settings.jira_field_tipo_iniciativa}"  # tipo_iniciativa (si existe)
                    )
                },
                headers=_headers(),
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

            issues = []
            for issue in data.get("issues", []):
                parsed = _parse_issue(issue, project_key)
                if parsed:
                    issues.append(parsed)

            logger.info(f"  ✓ {project_key}: {len(issues)} issues encontrados")
            return issues
    except Exception as e:
        logger.error(f"  ✗ Error fetching issues de {project_key}: {e}")
        return []


def _parse_issue(issue: dict, project_key: str) -> dict | None:
    """Parsea un issue desde Jira a dict para upsert."""
    try:
        fields = issue.get("fields", {})

        return {
            "jira_issue_id": issue.get("key"),
            "issue_type": fields.get("issuetype", {}).get("name"),
            "summary": fields.get("summary"),
            "story_points": fields.get("customfield_10017"),
            "estado": fields.get("status", {}).get("name"),
            "assignee": fields.get("assignee", {}).get("displayName"),
            "assignee_id": fields.get("assignee", {}).get("accountId"),
            "priority": fields.get("priority", {}).get("name"),
            "sprint_key": fields.get("sprint", {}).get("name") if fields.get("sprint") else None,
            "parent_issue_key": fields.get("parent", {}).get("key"),
            "parent_summary": fields.get("parent", {}).get("fields", {}).get("summary"),
            "labels": ",".join(fields.get("labels", [])) if fields.get("labels") else None,
            "resolution": fields.get("resolution", {}).get("name") if fields.get("resolution") else None,
            "tipo_iniciativa": fields.get(settings.jira_field_tipo_iniciativa),
            "reporter": fields.get("reporter", {}).get("displayName"),
            "reporter_id": fields.get("reporter", {}).get("accountId"),
            "due_date": fields.get("duedate"),
            "start_date": fields.get(settings.jira_field_start_date),
            "fecha_done": fields.get(settings.jira_field_fecha_done),
            "project_key": project_key,
            "project_name": fields.get("project", {}).get("name"),
        }
    except Exception as e:
        logger.error(f"  ✗ Error parsing issue {issue.get('key')}: {e}")
        return None


def _upsert_issues(db: Session, issues: list[dict]) -> tuple[int, int, list[str]]:
    """Upsert issues en jira_issues."""
    ok = errors = 0
    error_details: list[str] = []

    for issue in issues:
        try:
            stmt = (
                pg_insert(JiraIssue)
                .values(**issue, updated_at=datetime.now(timezone.utc))
                .on_conflict_do_update(
                    index_elements=["jira_issue_id"],
                    set_={
                        "summary": issue["summary"],
                        "story_points": issue.get("story_points"),
                        "estado": issue.get("estado"),
                        "assignee": issue.get("assignee"),
                        "priority": issue.get("priority"),
                        "sprint_key": issue.get("sprint_key"),
                        "parent_issue_key": issue.get("parent_issue_key"),
                        "labels": issue.get("labels"),
                        "resolution": issue.get("resolution"),
                        "due_date": issue.get("due_date"),
                        "start_date": issue.get("start_date"),
                        "fecha_done": issue.get("fecha_done"),
                        "updated_at": datetime.now(timezone.utc),
                    }
                )
            )
            db.execute(stmt)
            ok += 1
        except Exception as exc:
            msg = f"{issue.get('jira_issue_id')}: {exc}"
            logger.error(f"    ✗ upsert error {msg}")
            error_details.append(msg)
            errors += 1

    db.commit()
    return ok, errors, error_details


def run_issues_sync(force_full: bool = False) -> dict:
    """Sincroniza todos los issues desde Jira."""
    logger.info(_DIVIDER)
    sync_type = "FULL" if force_full else "DIFERENCIAL"
    logger.info(f"🔄  Sincronización {sync_type} Issues (Capacity)")
    started_at = datetime.now(timezone.utc)

    db = SessionLocal()
    total_upserted = total_errors = 0
    projects_result: list[dict] = []

    try:
        keys = _active_project_keys(db)
        if not keys:
            logger.warning("⚠️  Sin proyectos activos")
            return {"status": "no_projects"}

        logger.info(f"📋  Proyectos: {keys}")

        # Fetch todos los issues en paralelo
        project_issues = asyncio.run(_fetch_all_projects_async(keys))

        # Upsert por proyecto
        for key in keys:
            logger.info(f"  → {key}")
            try:
                issues = project_issues.get(key, [])
                upserted, errors, err_details = _upsert_issues(db, issues)
                total_upserted += upserted
                total_errors += errors

                entry: dict = {"key": key, "issues": upserted, "errors": errors}
                if err_details:
                    entry["error_details"] = err_details
                projects_result.append(entry)
            except Exception as exc:
                logger.error(f"  ✗ Error en upsert de {key}: {exc}")
                projects_result.append({"key": key, "issues": 0, "errors": 1, "error": str(exc)})
    except Exception as exc:
        logger.error(f"❌ Error fatal: {exc}")
        error_message = str(exc)
    else:
        error_message = None
    finally:
        ended_at = datetime.now(timezone.utc)
        duration = (ended_at - started_at).total_seconds()

        logger.info(
            f"✅  Completado en {duration:.1f}s — issues: {total_upserted} | errores: {total_errors}"
        )
        logger.info(_DIVIDER)

        db.close()

    return {
        "status": "ok" if not error_message else "error",
        "sync_type": sync_type,
        "duration_seconds": round(duration, 2),
        "total_upserted": total_upserted,
        "total_errors": total_errors,
        "projects": projects_result,
    }


async def _fetch_all_projects_async(keys: list[str]) -> dict[str, list[dict]]:
    """Fetch issues de todos los proyectos en paralelo."""
    tasks = [fetch_issues_for_project_async(key) for key in keys]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    project_issues: dict[str, list[dict]] = {}
    for key, result in zip(keys, results):
        if isinstance(result, Exception):
            logger.error(f"  ✗ Error fetching {key}: {result}")
            project_issues[key] = []
        else:
            project_issues[key] = result

    return project_issues
