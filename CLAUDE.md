# Dashboard Agile 2026 — Instrucciones para Claude

## Flujo de ramas (obligatorio)

Nunca hacer commits directamente en `main`. Cada Historia de Usuario o tarea se trabaja en una rama propia:

```
git checkout -b feat/<slug-corto>   # nueva feature
git checkout -b fix/<slug-corto>    # bugfix
git checkout -b chore/<slug-corto>  # mantenimiento
```

Al terminar, hacer push de la rama y abrir un PR hacia `main` con `gh pr create`.

### Convención de nombres de rama

| Tipo | Prefijo | Ejemplo |
|---|---|---|
| Historia de usuario / feature | `feat/` | `feat/us5-custom-fields-jira` |
| Corrección de bug | `fix/` | `fix/filtro-vp-cascada` |
| Infraestructura / config | `chore/` | `chore/update-schema-migration` |

## Stack

- **Backend**: FastAPI + SQLAlchemy + PostgreSQL (Supabase)
- **Frontend**: React + Vite + Axios
- **Sync Jira**: httpx client, POST `/rest/api/3/search/jql`, upsert via `pg_insert().on_conflict_do_update()`
- **Deploy**: Vercel (frontend) + Render o Railway (backend)

## Archivos clave

| Archivo | Propósito |
|---|---|
| `backend/app/config.py` | Variables de entorno y field IDs de Jira |
| `backend/sync_schema.sql` | Schema PostgreSQL + migraciones (ejecutar en Supabase) |
| `backend/app/models/jira_epic.py` | ORM `JiraEpic` + `ConfigProject` |
| `backend/app/schemas/jira_epic.py` | Pydantic response schemas |
| `backend/app/services/jira_client.py` | Fetcher Jira + parsers de campos |
| `backend/app/services/sync_service.py` | Motor de upsert y orquestador de sync |
