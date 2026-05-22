"""
US-1 + US-3: Jira Cloud client con Basic Auth y mapeo de épicas.
"""
from __future__ import annotations

import asyncio
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


def _parse_date(value: Any) -> datetime | None:
    if isinstance(value, dict):
        value = value.get("value") or value.get("date") or ""
    if not value:
        return None
    for fmt in _DATE_FORMATS:
        try:
            dt = datetime.strptime(value, fmt)
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


# ── Numeric helper ───────────────────────────────────────────────────────────

def _parse_numeric(value: Any) -> float | None:
    """Coerce cualquier valor Jira a float. Acepta int, float, str y dict con 'value'."""
    if value is None:
        return None
    if isinstance(value, dict):
        value = value.get("value")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ── Status normalizer ────────────────────────────────────────────────────────

_STATUS_MAP: dict[str, str] = {
    # Por Iniciar
    "to do":            "por_iniciar",
    "por iniciar":      "por_iniciar",
    "tareas por hacer": "por_iniciar",
    "backlog":          "por_iniciar",
    # En Desarrollo
    "in progress":      "en_desarrollo",
    "en proceso":       "en_desarrollo",
    "en desarrollo":    "en_desarrollo",
    # En Pruebas
    "in testing":       "en_pruebas",
    "en pruebas":       "en_pruebas",
    # En Ratificación / Review
    "in review":        "en_revision",
    "en ratificacion":  "en_revision",
    "en revision":      "en_revision",
    # En PRD
    "en prd":           "en_prd",
    "in prd":           "en_prd",
    # Finalizada
    "done":             "finalizada",
    "finalizada":       "finalizada",
    "closed":           "finalizada",
    "cerrada":          "finalizada",
}


def _normalize_status(status: str | None) -> str | None:
    """Mapea el nombre de estado de Jira a una categoría controlada."""
    if not status:
        return None
    return _STATUS_MAP.get(status.lower().strip())


# ── Custom quarter parser (US-4) ─────────────────────────────────────────────

# Acepta: "2026 -Q2", "2026-Q2", "2026 - Q2", "2026 -q2" — espacios/guion flexibles
_CUSTOM_QUARTER_RE = re.compile(r'(\d{4})\s*-\s*(Q[1-4])', re.IGNORECASE)


def _parse_custom_quarter(value: str | dict | None) -> tuple[int | None, str | None]:
    """Extrae (year, quarter) desde customfield_11302 con formato 'YYYY -QX'.
    Acepta string o dict (select field de Jira: {"value": "2026 -Q2"}).
    Retorna (None, None) si el valor está vacío o no coincide."""
    if isinstance(value, dict):
        value = value.get("value") or ""
    if not value:
        return None, None
    m = _CUSTOM_QUARTER_RE.search(value.strip())
    if m:
        return int(m.group(1)), m.group(2).upper()
    return None, None


# ── Sprint parser ────────────────────────────────────────────────────────────

def _parse_sprint(sprints: Any, last: bool = False) -> str | None:
    """Extrae el nombre del primer (o último si last=True) sprint de un array de objetos Sprint."""
    if not isinstance(sprints, list) or not sprints:
        return None
    target = sprints[-1] if last else sprints[0]
    if isinstance(target, dict):
        return target.get("name") or str(target.get("id"))
    return None


# ── Fetcher ───────────────────────────────────────────────────────────────────

async def fetch_epics_for_project_async(project_key: str) -> list[dict[str, Any]]:
    """
    Consulta async Jira JQL y retorna todas las Epics del proyecto.
    Versión parallelizable para sync.
    """
    jql = f'project = "{project_key}" AND issuetype = Epic ORDER BY created DESC'
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
        settings.jira_field_quarter,
        settings.jira_field_sprint_inicio,
        settings.jira_field_estimacion_ini,
        settings.jira_field_estimacion_fin,
        settings.jira_field_estado_iniciativa,
        settings.jira_field_fecha_done,
        settings.jira_field_fecha_prd,
        settings.jira_field_sprint_fin,
    ]

    epics: list[dict] = []
    next_page_token: str | None = None

    async with httpx.AsyncClient(headers=_headers(), timeout=30) as client:
        while True:
            body: dict[str, Any] = {
                "jql": jql,
                "maxResults": 100,
                "fields": fields,
            }
            if next_page_token:
                body["nextPageToken"] = next_page_token

            try:
                resp = await client.post(url, json=body)
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
                year, quarter = _parse_custom_quarter(f.get(settings.jira_field_quarter))
                if year is None:
                    year, quarter = _parse_label(f.get("labels"))

                epics.append({
                    "jira_issue_id":    issue["key"],
                    "epic_name":        f.get("summary") or "Sin nombre",
                    "description":      _extract_text(f.get("description")),
                    "start_date":       start_dt,
                    "due_date":         due_dt,
                    "lead_time_days":   _lead_time_days(start_dt, due_dt),
                    "status":           (f.get("status") or {}).get("name"),
                    "estado_normalizado": _normalize_status((f.get("status") or {}).get("name")),
                    "assignee":         (f.get("assignee") or {}).get("displayName"),
                    "priority_status":  (f.get("priority") or {}).get("name"),
                    "project_key":      project_key,
                    "year":             year,
                    "quarter":          quarter,
                    "priority_quarter":  f"{quarter} {year}" if quarter and year else None,
                    "sprint_inicio":     (f.get(settings.jira_field_sprint_inicio) or {}).get("value"),
                    "estimacion_inicial": (f.get(settings.jira_field_estimacion_ini) or {}).get("value"),
                    "estimacion_final":   (f.get(settings.jira_field_estimacion_fin) or {}).get("value"),
                    "estado_iniciativa":  (f.get(settings.jira_field_estado_iniciativa) or {}).get("value"),
                    "fecha_done":         (dt := _parse_date(f.get(settings.jira_field_fecha_done))) and dt.date() or None,
                    "fecha_prd":          (dt := _parse_date(f.get(settings.jira_field_fecha_prd))) and dt.date() or None,
                    "sprint_fin":         (f.get(settings.jira_field_sprint_fin) or {}).get("value"),
                })

            next_page_token = data.get("nextPageToken")
            if not next_page_token or len(issues) < 100:
                break

    logger.info("  ✅ %s → %d épicas obtenidas.", project_key, len(epics))
    return epics


def fetch_epics_for_project(project_key: str) -> list[dict[str, Any]]:
    """
    Consulta Jira JQL y retorna todas las Epics del proyecto mapeadas
    al esquema de jira_epics. Wrapper sincrónico.
    """
    return asyncio.run(fetch_epics_for_project_async(project_key))


async def fetch_epics_since_async(project_key: str, since_timestamp: str) -> list[dict[str, Any]]:
    """
    Consulta async épicas modificadas desde una fecha (sync diferencial).
    Formato de since_timestamp: ISO 8601 con timezone, ej: "2026-05-22T16:50:00+00:00"
    Convierte a formato que Jira entiende: "YYYY-MM-DD HH:mm"
    """
    # Convierte ISO 8601 a formato Jira: "2026-05-22 21:35:42"
    dt = datetime.fromisoformat(since_timestamp.replace('Z', '+00:00'))
    jira_timestamp = dt.strftime("%Y-%m-%d %H:%M")
    jql = f'project = "{project_key}" AND issuetype = Epic AND updated >= "{jira_timestamp}" ORDER BY updated DESC'
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
        settings.jira_field_quarter,
        settings.jira_field_sprint_inicio,
        settings.jira_field_estimacion_ini,
        settings.jira_field_estimacion_fin,
        settings.jira_field_estado_iniciativa,
        settings.jira_field_fecha_done,
        settings.jira_field_fecha_prd,
        settings.jira_field_sprint_fin,
    ]

    epics: list[dict] = []
    next_page_token: str | None = None

    async with httpx.AsyncClient(headers=_headers(), timeout=30) as client:
        while True:
            body: dict[str, Any] = {
                "jql": jql,
                "maxResults": 100,
                "fields": fields,
            }
            if next_page_token:
                body["nextPageToken"] = next_page_token

            try:
                resp = await client.post(url, json=body)
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
                year, quarter = _parse_custom_quarter(f.get(settings.jira_field_quarter))
                if year is None:
                    year, quarter = _parse_label(f.get("labels"))

                epics.append({
                    "jira_issue_id":    issue["key"],
                    "epic_name":        f.get("summary") or "Sin nombre",
                    "description":      _extract_text(f.get("description")),
                    "start_date":       start_dt,
                    "due_date":         due_dt,
                    "lead_time_days":   _lead_time_days(start_dt, due_dt),
                    "status":           (f.get("status") or {}).get("name"),
                    "estado_normalizado": _normalize_status((f.get("status") or {}).get("name")),
                    "assignee":         (f.get("assignee") or {}).get("displayName"),
                    "priority_status":  (f.get("priority") or {}).get("name"),
                    "project_key":      project_key,
                    "year":             year,
                    "quarter":          quarter,
                    "priority_quarter":  f"{quarter} {year}" if quarter and year else None,
                    "sprint_inicio":     (f.get(settings.jira_field_sprint_inicio) or {}).get("value"),
                    "estimacion_inicial": (f.get(settings.jira_field_estimacion_ini) or {}).get("value"),
                    "estimacion_final":   (f.get(settings.jira_field_estimacion_fin) or {}).get("value"),
                    "estado_iniciativa":  (f.get(settings.jira_field_estado_iniciativa) or {}).get("value"),
                    "fecha_done":         (dt := _parse_date(f.get(settings.jira_field_fecha_done))) and dt.date() or None,
                    "fecha_prd":          (dt := _parse_date(f.get(settings.jira_field_fecha_prd))) and dt.date() or None,
                    "sprint_fin":         (f.get(settings.jira_field_sprint_fin) or {}).get("value"),
                })

            next_page_token = data.get("nextPageToken")
            if not next_page_token or len(issues) < 100:
                break

    logger.info("  ✅ %s → %d épicas (desde %s)", project_key, len(epics), since_timestamp)
    return epics


def fetch_epics_since(project_key: str, since_timestamp: str) -> list[dict[str, Any]]:
    """Wrapper sincrónico para fetch_epics_since_async."""
    return asyncio.run(fetch_epics_since_async(project_key, since_timestamp))
