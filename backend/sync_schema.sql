-- =============================================================
-- Jira-to-Supabase Sync Schema
-- Ejecutar en Supabase SQL Editor
-- =============================================================

-- 1. Proyectos a trackear
CREATE TABLE IF NOT EXISTS config_projects (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_key  TEXT NOT NULL UNIQUE,
    project_name TEXT,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seed inicial
INSERT INTO config_projects (project_key, project_name) VALUES
    ('SQP', 'Squad Pagos'),
    ('SQV', 'Squad Vision')
ON CONFLICT (project_key) DO NOTHING;

-- 2. Épicas sincronizadas desde Jira
CREATE TABLE IF NOT EXISTS jira_epics (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jira_issue_id    TEXT NOT NULL UNIQUE,          -- ej. "SQP-42"
    epic_name        TEXT NOT NULL,
    description      TEXT,
    start_date       TIMESTAMPTZ,
    priority_quarter TEXT,                           -- ej. "Q2-2026"
    priority_status  TEXT,                           -- High / Medium / Low
    due_date         TIMESTAMPTZ,
    project_key      TEXT NOT NULL
        REFERENCES config_projects(project_key) ON DELETE RESTRICT,
    lead_time_days   INT,                            -- calculado: due_date - start_date
    status           TEXT,                           -- estado Jira: "In Progress", "Done", etc.
    assignee         TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jira_epics_project_key ON jira_epics(project_key);
CREATE INDEX IF NOT EXISTS idx_jira_epics_status      ON jira_epics(status);
CREATE INDEX IF NOT EXISTS idx_jira_epics_due_date    ON jira_epics(due_date);

-- Migration: columnas ETL año/trimestre (US-3)
-- Ejecutar si la tabla ya existía antes de esta versión
ALTER TABLE jira_epics
    ADD COLUMN IF NOT EXISTS year    INT,
    ADD COLUMN IF NOT EXISTS quarter TEXT;

-- Migration: campos ciclo de vida iniciativas (US-5)
ALTER TABLE jira_epics
    ADD COLUMN IF NOT EXISTS sprint_inicio      TEXT,
    ADD COLUMN IF NOT EXISTS estimacion_inicial NUMERIC,
    ADD COLUMN IF NOT EXISTS estimacion_final   NUMERIC,
    ADD COLUMN IF NOT EXISTS estado_iniciativa  TEXT,
    ADD COLUMN IF NOT EXISTS fecha_done         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fecha_prd          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sprint_fin         TEXT;

-- 3. Trigger updated_at automático
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jira_epics_updated_at ON jira_epics;
CREATE TRIGGER trg_jira_epics_updated_at
    BEFORE UPDATE ON jira_epics
    FOR EACH ROW EXECUTE PROCEDURE _set_updated_at();
