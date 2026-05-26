"""
US-4: Motor de sincronización Jira → Supabase.
Upsert basado en jira_issue_id para evitar duplicados.
Soporta sincronización diferencial y full sync cada 24h.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.jira_epic import ConfigProject, JiraEpic, SyncLog, SyncMetric
from .jira_client import fetch_epics_for_project_async, fetch_epics_since_async

logger = logging.getLogger(__name__)

_DIVIDER = "━" * 48


def _active_project_keys(db: Session) -> list[str]:
    rows = db.query(ConfigProject.project_key).filter(ConfigProject.is_active.is_(True)).all()
    return [r[0] for r in rows]


def _get_project_config(db: Session, project_key: str) -> ConfigProject | None:
    return db.query(ConfigProject).filter_by(project_key=project_key).first()


def _upsert_epics(db: Session, epics: list[dict]) -> tuple[int, int, list[str]]:
    ok = errors = 0
    error_details: list[str] = []
    for epic in epics:
        try:
            stmt = (
                pg_insert(JiraEpic)
                .values(
                    jira_issue_id=epic["jira_issue_id"],
                    epic_name=epic["epic_name"],
                    description=epic.get("description"),
                    start_date=epic.get("start_date"),
                    due_date=epic.get("due_date"),
                    lead_time_days=epic.get("lead_time_days"),
                    status=epic.get("status"),
                    estado_normalizado=epic.get("estado_normalizado"),
                    assignee=epic.get("assignee"),
                    priority_status=epic.get("priority_status"),
                    priority_quarter=epic.get("priority_quarter"),
                    year=epic.get("year"),
                    quarter=epic.get("quarter"),
                    sprint_inicio=epic.get("sprint_inicio"),
                    estimacion_inicial=epic.get("estimacion_inicial"),
                    estimacion_final=epic.get("estimacion_final"),
                    estado_iniciativa=epic.get("estado_iniciativa"),
                    fecha_done=epic.get("fecha_done"),
                    fecha_prd=epic.get("fecha_prd"),
                    sprint_fin=epic.get("sprint_fin"),
                    project_key=epic["project_key"],
                    updated_at=datetime.now(timezone.utc),
                )
                .on_conflict_do_update(
                    index_elements=["jira_issue_id"],
                    set_={
                        "epic_name":          epic["epic_name"],
                        "description":        epic.get("description"),
                        "start_date":         epic.get("start_date"),
                        "due_date":           epic.get("due_date"),
                        "lead_time_days":     epic.get("lead_time_days"),
                        "status":              epic.get("status"),
                        "estado_normalizado":  epic.get("estado_normalizado"),
                        "assignee":            epic.get("assignee"),
                        "priority_status":    epic.get("priority_status"),
                        "priority_quarter":   epic.get("priority_quarter"),
                        "year":               epic.get("year"),
                        "quarter":            epic.get("quarter"),
                        "sprint_inicio":      epic.get("sprint_inicio"),
                        "estimacion_inicial": epic.get("estimacion_inicial"),
                        "estimacion_final":   epic.get("estimacion_final"),
                        "estado_iniciativa":  epic.get("estado_iniciativa"),
                        "fecha_done":         epic.get("fecha_done"),
                        "fecha_prd":          epic.get("fecha_prd"),
                        "sprint_fin":         epic.get("sprint_fin"),
                        "updated_at":         datetime.now(timezone.utc),
                    },
                )
            )
            db.execute(stmt)
            ok += 1
        except Exception as exc:
            msg = f"{epic.get('jira_issue_id')}: {exc}"
            logger.error("    ✗ upsert error %s", msg)
            error_details.append(msg)
            errors += 1
    db.commit()
    return ok, errors, error_details


def _save_sync_log(
    db: Session,
    sync_type: str,
    started_at: datetime,
    ended_at: datetime,
    duration: float,
    total_upserted: int,
    total_errors: int,
    projects_result: list[dict],
    error_message: str | None = None,
) -> None:
    """Guarda registro de sincronización en sync_logs."""
    status = "error" if error_message else ("partial" if total_errors > 0 else "success")
    log = SyncLog(
        sync_type=sync_type,
        started_at=started_at,
        ended_at=ended_at,
        duration_seconds=round(duration, 2),
        total_upserted=total_upserted,
        total_errors=total_errors,
        status=status,
        error_message=error_message,
        projects_detail=projects_result,
    )
    db.add(log)
    db.commit()


def _check_sync_alerts(
    duration: float,
    total_upserted: int,
    total_errors: int,
    sync_type: str,
) -> None:
    """Loguea alertas si hay issues en la sincronización."""
    if total_upserted == 0:
        logger.warning("⚠️  Sin épicas sincronizadas (posible problema de conectividad)")

    error_rate = (total_errors / (total_errors + total_upserted) * 100) if (total_errors + total_upserted) > 0 else 0
    if error_rate > 10:
        logger.critical("🚨 ALERTA: Error rate %.1f%% (>10%%) | Errores: %d", error_rate, total_errors)

    if sync_type == "DIFERENCIAL" and duration > 300:
        logger.warning("⚠️  Sync diferencial tardó %.1fs (>5 min)", duration)
    elif sync_type == "FULL" and duration > 600:
        logger.warning("⚠️  Full sync tardó %.1fs (>10 min)", duration)


async def _fetch_all_projects_async(
    keys: list[str],
    since_timestamp: str | None = None
) -> dict[str, list[dict]]:
    """Fetch todos los proyectos en paralelo (full o diferencial según since_timestamp)."""
    if since_timestamp:
        tasks = [fetch_epics_since_async(key, since_timestamp) for key in keys]
    else:
        tasks = [fetch_epics_for_project_async(key) for key in keys]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    project_epics: dict[str, list[dict]] = {}
    for key, result in zip(keys, results):
        if isinstance(result, Exception):
            logger.error("  ✗ Error fetching %s: %s", key, result)
            project_epics[key] = []
        else:
            project_epics[key] = result
    return project_epics


async def _fetch_differential_async(
    keys: list[str],
    since_map: dict[str, str]
) -> dict[str, list[dict]]:
    """Fetch diferencial para algunos proyectos y full para otros."""
    tasks_diff = [
        fetch_epics_since_async(key, since_map[key])
        for key in keys if key in since_map
    ]
    tasks_full = [
        fetch_epics_for_project_async(key)
        for key in keys if key not in since_map
    ]
    
    results = []
    if tasks_diff:
        results.extend(await asyncio.gather(*tasks_diff, return_exceptions=True))
    if tasks_full:
        results.extend(await asyncio.gather(*tasks_full, return_exceptions=True))

    project_epics: dict[str, list[dict]] = {}
    diff_keys = [k for k in keys if k in since_map]
    full_keys = [k for k in keys if k not in since_map]
    all_keys = diff_keys + full_keys
    
    for key, result in zip(all_keys, results):
        if isinstance(result, Exception):
            logger.error("  ✗ Error fetching %s: %s", key, result)
            project_epics[key] = []
        else:
            project_epics[key] = result
    
    return project_epics


def run_sync(force_full_sync: bool = False) -> dict:
    """
    Sincroniza épicas de Jira → Supabase.
    - Si force_full_sync=False (default): Sync diferencial (solo cambios desde last_sync)
    - Si force_full_sync=True: Full sync (todos los épicos)
    """
    logger.info(_DIVIDER)
    sync_type = "FULL" if force_full_sync else "DIFERENCIAL"
    logger.info("🔄  Sincronización %s Jira → Supabase iniciada", sync_type)
    started_at = datetime.now(timezone.utc)

    db = SessionLocal()
    total_upserted = total_errors = 0
    projects_result: list[dict] = []

    try:
        keys = _active_project_keys(db)
        if not keys:
            logger.warning("⚠️  Sin proyectos activos en config_projects.")
            return {"status": "no_projects", "projects": []}

        logger.info("📋  Proyectos: %s", keys)

        # Determinar si es sync diferencial o full
        if force_full_sync:
            logger.info("  ℹ️  FULL SYNC — trayendo todos los épicos")
            project_epics = asyncio.run(_fetch_all_projects_async(keys, since_timestamp=None))
        else:
            # Sync diferencial: usar last_sync_timestamp de cada proyecto
            since_map: dict[str, str] = {}
            for key in keys:
                config = _get_project_config(db, key)
                if config and config.last_sync_timestamp:
                    since_map[key] = config.last_sync_timestamp.isoformat()
                else:
                    logger.info("  ℹ️  %s — primera sincronización (full)", key)

            # Fetch diferencial para los que tienen timestamp, full para los que no
            project_epics = asyncio.run(_fetch_differential_async(keys, since_map))

        # Upsert resultados
        for key in keys:
            logger.info("  → %s", key)
            try:
                epics = project_epics.get(key, [])
                upserted, errors, err_details = _upsert_epics(db, epics)
                total_upserted += upserted
                total_errors += errors
                
                # Actualizar last_sync_timestamp
                config = _get_project_config(db, key)
                if config:
                    config.last_sync_timestamp = datetime.now(timezone.utc)
                    db.commit()
                
                entry: dict = {"key": key, "epics": upserted, "errors": errors}
                if err_details:
                    entry["error_details"] = err_details
                projects_result.append(entry)
            except Exception as exc:
                logger.error("  ✗ Error en upsert de %s: %s", key, exc)
                projects_result.append({"key": key, "epics": 0, "errors": 1, "error": str(exc)})
    except Exception as exc:
        logger.error("❌ Error fatal en sincronización: %s", exc)
        error_message = str(exc)
    else:
        error_message = None
    finally:
        ended_at = datetime.now(timezone.utc)
        duration = (ended_at - started_at).total_seconds()

        try:
            _save_sync_log(
                db,
                sync_type=sync_type,
                started_at=started_at,
                ended_at=ended_at,
                duration=duration,
                total_upserted=total_upserted,
                total_errors=total_errors,
                projects_result=projects_result,
                error_message=error_message,
            )
            _check_sync_alerts(duration, total_upserted, total_errors, sync_type)
        except Exception as e:
            logger.error("⚠️  No se pudo guardar sync_log: %s", e)

        db.close()

    logger.info(
        "✅  Completado en %.1fs — épicas: %d | errores: %d",
        duration, total_upserted, total_errors,
    )
    logger.info(_DIVIDER)

    return {
        "status": "ok" if not error_message else "error",
        "sync_type": sync_type,
        "started_at": started_at.isoformat(),
        "duration_seconds": round(duration, 2),
        "total_upserted": total_upserted,
        "total_errors": total_errors,
        "projects": projects_result,
    }


def _aggregate_daily_metrics(db: Session) -> None:
    """Agrega métricas diarias basadas en sync_logs del día."""
    from datetime import date, time

    today = date.today()
    since = datetime(today.year, today.month, today.day, 0, 0, 0, tzinfo=timezone.utc)
    until = datetime(today.year, today.month, today.day, 23, 59, 59, tzinfo=timezone.utc)

    logs = db.query(SyncLog).filter(
        SyncLog.created_at >= since,
        SyncLog.created_at <= until
    ).all()

    if not logs:
        logger.info("ℹ️  Sin logs de sync hoy, omitiendo agregación de métricas")
        return

    sync_count = len(logs)
    total_upserted = sum(log.total_upserted or 0 for log in logs)
    total_errors = sum(log.total_errors or 0 for log in logs)
    total_attempts = total_upserted + total_errors

    durations = [log.duration_seconds for log in logs if log.duration_seconds]
    avg_duration = sum(durations) / len(durations) if durations else None
    fastest_sync = min(durations) if durations else None
    slowest_sync = max(durations) if durations else None

    error_rate = (total_errors / total_attempts * 100) if total_attempts > 0 else 0

    # Upsert métrica del día
    from sqlalchemy import select
    existing = db.query(SyncMetric).filter(SyncMetric.date == today).first()

    if existing:
        existing.sync_count = sync_count
        existing.avg_duration_seconds = avg_duration
        existing.total_epics_upserted = total_upserted
        existing.total_errors = total_errors
        existing.error_rate = round(error_rate, 2)
        existing.fastest_sync_seconds = fastest_sync
        existing.slowest_sync_seconds = slowest_sync
        db.commit()
        logger.info("📊 Métricas del día actualizadas: %d syncs, %.1f épicas/sync, %.1f%% error",
                   sync_count, total_upserted/sync_count if sync_count else 0, error_rate)
    else:
        metric = SyncMetric(
            date=today,
            sync_count=sync_count,
            avg_duration_seconds=avg_duration,
            total_epics_upserted=total_upserted,
            total_errors=total_errors,
            error_rate=round(error_rate, 2),
            fastest_sync_seconds=fastest_sync,
            slowest_sync_seconds=slowest_sync,
        )
        db.add(metric)
        db.commit()
        logger.info("📊 Métrica diaria creada: %d syncs, %.1f épicas/sync, %.1f%% error",
                   sync_count, total_upserted/sync_count if sync_count else 0, error_rate)



def _cleanup_orphaned_epics(db: Session, sync_started_at: datetime, project_keys: list[str]) -> tuple[int, list[str]]:
    """
    Elimina épicas huérfanas que NO fueron actualizadas en este full sync.
    
    Lógica: Si un épica en BD tiene updated_at < sync_started_at, significa que
    fue ignorada en el full sync, por lo tanto ya no existe en Jira.
    
    Retorna: (cantidad_eliminadas, lista_de_keys_eliminadas)
    """
    deleted_count = 0
    deleted_keys: list[str] = []
    
    for project_key in project_keys:
        try:
            # Buscar épicas que NO fueron actualizadas en este sync
            orphaned = db.query(JiraEpic).filter(
                JiraEpic.project_key == project_key,
                JiraEpic.updated_at < sync_started_at
            ).all()
            
            for epic in orphaned:
                logger.info("    🗑️  Eliminando épica huérfana: %s (%s)", 
                           epic.jira_issue_id, epic.epic_name)
                db.delete(epic)
                deleted_keys.append(epic.jira_issue_id)
                deleted_count += 1
            
            db.commit()
            
            if deleted_count > 0:
                logger.info("  → %s: %d épicas eliminadas (ya no existen en Jira)", 
                           project_key, deleted_count)
        except Exception as exc:
            logger.error("  ✗ Error limpiando orphaned epics en %s: %s", project_key, exc)
            db.rollback()
    
    return deleted_count, deleted_keys


def run_full_sync() -> dict:
    """
    Ejecuta un full sync (fuerza traer todos los épicos) y:
    1. Agrega métricas diarias
    2. Limpia épicas huérfanas (eliminadas en Jira)
    """
    logger.info(_DIVIDER)
    logger.info("🔄  FULL SYNC PROGRAMADO cada 24h")
    logger.info(_DIVIDER)
    
    # Capturar timestamp de inicio ANTES del sync
    sync_started_at = datetime.now(timezone.utc)
    
    # Ejecutar full sync normal
    result = run_sync(force_full_sync=True)

    # Agregar métricas diarias y limpiar huérfanos después del full sync
    db = SessionLocal()
    try:
        _aggregate_daily_metrics(db)
        
        # ↓↓↓ LIMPIAR ÉPICAS HUÉRFANAS ↓↓↓
        keys = _active_project_keys(db)
        if keys:
            logger.info("🧹 Limpiando épicas eliminadas en Jira...")
            deleted_count, deleted_keys = _cleanup_orphaned_epics(db, sync_started_at, keys)
            
            if deleted_count > 0:
                result["cleanup"] = {
                    "deleted_count": deleted_count,
                    "deleted_keys": deleted_keys,
                }
                logger.info("✅ Limpieza completada: %d épicas removidas", deleted_count)
            else:
                logger.info("✅ Limpieza completada: sin épicas huérfanas")
        
    except Exception as e:
        logger.error("⚠️  Error en post-sync: %s", e)
    finally:
        db.close()

    return result
