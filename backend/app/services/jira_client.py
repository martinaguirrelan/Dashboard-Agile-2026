"""
US-1 + US-3: Jira Cloud client con Basic Auth y mapeo de épicas.
"""
from __future__ import annotations

import base64
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


# ── Auth ──────────────────────────────────────────────────────────────────────

def _basic_auth_header() -> str:
    raw = f"{settings.jira_user_email}:{settings.jira_api_token}"
    return "Basic " + base64.b64encode(raw.encode()).decode()


def _headers() -> dict[str, str]:
    return {
        "Authorization": _basic_auth_header(),
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


# ── Date helpers ──────────────────────────────────────────────────────────────

_DATE_FORMATS = (
    "%Y-%m-%dT%H:%M:%S.%f%z",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%d",
)


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in _DATE_FORMATS:
        try:
            dt = datetime.strptime(value[: len(fmt) + 5], fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except (ValueError, TypeError):
            continue
    return None


def _lead_time_days(start: datetime | None, due: datetime | None) -> int | None:
    """Días enteros entre start_date y due_date. Nunca negativo."""
    if start is None or due is None:
        return None
    return max(0, (due - start).days)


# ── Description extractor (Atlassian Document Format) ─────────────────────────

def _extract_text(adf: Any) -> str | None:
    """Extrae texto plano desde el Atlassian Document Format."""
    if not isinstance(adf, dict):
        return str(adf) if adf else None
    parts: list[str] = []
    for block in adf.get("content", []):
        for inline in block.get("content", []):
            text = inline.get("text", "")
            if text:
                parts.append(text)
    result = " ".join(parts).strip()
    return result or None


# ── Label parser (US-3) ───────────────────────────────────────────────────────

# Acepta: "#2026Q2", "2026Q2", "#2026q2" — case-insensitive, # opcional
_LABEL_RE = re.compile(r'^#?(\d{4})Q([1-4])$', re.IGNORECASE)


def _parse_label(labels: list[str] | None) -> tuple[int | None, str | None]:
    """Extrae (year, quarter) del primer label con formato #YYYYQn.
    Retorna (None, None) si no hay ningún label válido."""
    for label in (labels or []):
        m = _LABEL_RE.match(label.strip())
        if m:
            return int(m.group(1)), f"Q{m.group(2).upper()}"
    return None, None


# ── Fetcher ───────────────────────────────────────────────────────────────────

def fetch_epics_for_project(project_key: str) -> list[dict[str, Any]]:
    """
    Consulta Jira JQL y retorna todas las Epics del proyecto mapeadas
    al esquema de jira_epics.
    """
    jql = f'project = "{project_key}" AND issuetype = Epic ORDER BY created DESC'
    # Jira Cloud deprecó GET /search — ahora usa POST /search/jql
    url = f"{settings.jira_base_url}/rest/api/3/search/jql"
    fields = [
        "summary",
        "description",
        "duedate",
        "status",
        "assignee",
        "priority",
        "labels",
        settings.jira_field_start_date,
    ]

    epics: list[dict] = []
    next_page_token: str | None = None

    with httpx.Client(headers=_headers(), timeout=30) as client:
        while True:
            body: dict[str, Any] = {
                "jql": jql,
                "maxResults": 100,
                "fields": fields,
            }
            if next_page_token:
                body["nextPageToken"] = next_page_token

            try:
                resp = client.post(url, json=body)
                resp.raise_for_status()
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                if status_code in (400, 404):
                    logger.warning(
                        "⚠️  Proyecto '%s' no encontrado en Jira o JQL inválido. (%s)",
                        project_key, exc.response.text[:200],
                    )
                    return []
                raise

            data: dict = resp.json()
            issues: list = data.get("issues", [])
            if not issues:
                break

            for issue in issues:
                f = issue.get("fields", {})
                start_dt = _parse_date(f.get(settings.jira_field_start_date))
                due_dt   = _parse_date(f.get("duedate"))
                year, quarter = _parse_label(f.get("labels"))

                epics.append({
                    "jira_issue_id":    issue["key"],
                    "epic_name":        f.get("summary") or "Sin nombre",
                    "description":      _extract_text(f.get("description")),
                    "start_date":       start_dt,
                    "due_date":         due_dt,
                    "lead_time_days":   _lead_time_days(start_dt, due_dt),
                    "status":           (f.get("status") or {}).get("name"),
                    "assignee":         (f.get("assignee") or {}).get("displayName"),
                    "priority_status":  (f.get("priority") or {}).get("name"),
                    "project_key":      project_key,
                    "year":             year,
                    "quarter":          quarter,
                    "priority_quarter": f"{quarter} {year}" if quarter and year else None,
                })

            next_page_token = data.get("nextPageToken")
            if not next_page_token or len(issues) < 100:
                break

    logger.info("  ✅ %s → %d épicas obtenidas.", project_key, len(epics))
    return epics
