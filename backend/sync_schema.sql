-- =============================================================
-- Jira-to-Supabase Sync Schema
-- Ejecutar en Supabase SQL Editor
-- =============================================================

-- 1. Proyectos a trackear
CREATE TABLE IF NOT EXISTS config_projects (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_key          TEXT NOT NULL UNIQUE,
    project_name         TEXT,
    is_active            BOOLEAN DEFAULT TRUE,
    last_sync_timestamp  TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW()
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

-- Migration: estado normalizado para KPIs del dashboard
ALTER TABLE jira_epics
    ADD COLUMN IF NOT EXISTS estado_normalizado TEXT;
    -- Valores controlados: por_iniciar | en_desarrollo | en_pruebas | en_revision | en_prd | finalizada

-- Migration: campos ciclo de vida iniciativas (US-5)
ALTER TABLE jira_epics
    ADD COLUMN IF NOT EXISTS sprint_inicio      TEXT,
    ADD COLUMN IF NOT EXISTS estimacion_inicial TEXT,
    ADD COLUMN IF NOT EXISTS estimacion_final   TEXT,
    ADD COLUMN IF NOT EXISTS estado_iniciativa  TEXT,
    ADD COLUMN IF NOT EXISTS fecha_done         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fecha_prd          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sprint_fin         TEXT;

-- Migration: fecha_done y fecha_prd cambian de TIMESTAMPTZ a DATE (solo fecha, sin hora)
ALTER TABLE jira_epics
    ALTER COLUMN fecha_done TYPE DATE USING fecha_done::DATE,
    ALTER COLUMN fecha_prd  TYPE DATE USING fecha_prd::DATE;

-- Migration: estimacion_inicial/final cambian de NUMERIC a TEXT (tallas T-shirt: S, M, L, XL)
ALTER TABLE jira_epics
    ALTER COLUMN estimacion_inicial TYPE TEXT USING estimacion_inicial::TEXT,
    ALTER COLUMN estimacion_final   TYPE TEXT USING estimacion_final::TEXT;

-- Migration: last_sync_timestamp para sincronización diferencial
ALTER TABLE config_projects
    ADD COLUMN IF NOT EXISTS last_sync_timestamp TIMESTAMPTZ;

-- 3. Trimestres (para Épica 2: Iniciativas Agregadas)
CREATE TABLE IF NOT EXISTS trimestres (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quarter       TEXT NOT NULL UNIQUE,               -- ej. "Q1-2026"
    anio          INT NOT NULL,                       -- ej. 2026
    numero        INT NOT NULL,                       -- 1, 2, 3, 4
    fecha_inicio  DATE NOT NULL,                      -- primer día del trimestre
    fecha_fin     DATE NOT NULL,                      -- último día del trimestre
    descripcion   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trimestres_quarter ON trimestres(quarter);
CREATE INDEX IF NOT EXISTS idx_trimestres_anio   ON trimestres(anio);

-- Seed inicial de trimestres 2026
INSERT INTO trimestres (quarter, anio, numero, fecha_inicio, fecha_fin, descripcion) VALUES
    ('Q1-2026', 2026, 1, '2026-01-01', '2026-03-31', 'Primer trimestre 2026'),
    ('Q2-2026', 2026, 2, '2026-04-01', '2026-06-30', 'Segundo trimestre 2026'),
    ('Q3-2026', 2026, 3, '2026-07-01', '2026-09-30', 'Tercer trimestre 2026'),
    ('Q4-2026', 2026, 4, '2026-10-01', '2026-12-31', 'Cuarto trimestre 2026')
ON CONFLICT (quarter) DO NOTHING;

-- 4. Sprints (para Épica 1: Lead Time por Sprint)
CREATE TABLE IF NOT EXISTS sprints (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_key    TEXT NOT NULL UNIQUE,               -- ej. "SQP-Sprint-1"
    sprint_name   TEXT NOT NULL,                      -- ej. "Sprint 1"
    numero        INT NOT NULL,                       -- número secuencial del sprint
    project_key   TEXT NOT NULL
        REFERENCES config_projects(project_key) ON DELETE RESTRICT,
    fecha_inicio  DATE NOT NULL,
    fecha_fin     DATE NOT NULL,
    estado        TEXT,                               -- "active" | "closed" | "future"
    descripcion   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sprints_project_key ON sprints(project_key);
CREATE INDEX IF NOT EXISTS idx_sprints_estado      ON sprints(estado);
CREATE INDEX IF NOT EXISTS idx_sprints_fecha_inicio ON sprints(fecha_inicio);

-- Seed inicial de sprints (4 sprints por proyecto, Q2-2026)
INSERT INTO sprints (sprint_key, sprint_name, numero, project_key, fecha_inicio, fecha_fin, estado) VALUES
    -- SQP (Squad Pagos)
    ('SQP-Sprint-21', 'Sprint 21', 21, 'SQP', '2026-04-06', '2026-04-19', 'closed'),
    ('SQP-Sprint-22', 'Sprint 22', 22, 'SQP', '2026-04-20', '2026-05-03', 'closed'),
    ('SQP-Sprint-23', 'Sprint 23', 23, 'SQP', '2026-05-04', '2026-05-17', 'active'),
    ('SQP-Sprint-24', 'Sprint 24', 24, 'SQP', '2026-05-18', '2026-06-30', 'future'),
    -- SQV (Squad Vision)
    ('SQV-Sprint-17', 'Sprint 17', 17, 'SQV', '2026-04-06', '2026-04-19', 'closed'),
    ('SQV-Sprint-18', 'Sprint 18', 18, 'SQV', '2026-04-20', '2026-05-03', 'closed'),
    ('SQV-Sprint-19', 'Sprint 19', 19, 'SQV', '2026-05-04', '2026-05-17', 'active'),
    ('SQV-Sprint-20', 'Sprint 20', 20, 'SQV', '2026-05-18', '2026-06-30', 'future')
ON CONFLICT (sprint_key) DO NOTHING;

-- 5. Histórico de sincronizaciones (Auditoría y Testing)
CREATE TABLE IF NOT EXISTS sync_logs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type          TEXT NOT NULL,           -- "FULL" | "DIFERENCIAL"
    started_at         TIMESTAMPTZ NOT NULL,
    ended_at           TIMESTAMPTZ,
    duration_seconds   FLOAT,
    total_upserted     INT,
    total_errors       INT,
    status             TEXT,                   -- "success" | "partial" | "error"
    error_message      TEXT,
    projects_detail    JSONB,                  -- [{key, epics, errors}, ...]
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status     ON sync_logs(status);

-- 6. Métricas diarias agregadas de sincronizaciones
CREATE TABLE IF NOT EXISTS sync_metrics (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date                    DATE NOT NULL UNIQUE,
    sync_count              INT DEFAULT 0,
    avg_duration_seconds    FLOAT,
    total_epics_upserted    INT DEFAULT 0,
    total_errors            INT DEFAULT 0,
    error_rate              FLOAT,              -- % (errors / total_attempts)
    fastest_sync_seconds    FLOAT,
    slowest_sync_seconds    FLOAT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_metrics_date ON sync_metrics(date DESC);

-- 7. Triggers para updated_at automático
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

DROP TRIGGER IF EXISTS trg_trimestres_updated_at ON trimestres;
CREATE TRIGGER trg_trimestres_updated_at
    BEFORE UPDATE ON trimestres
    FOR EACH ROW EXECUTE PROCEDURE _set_updated_at();

DROP TRIGGER IF EXISTS trg_sprints_updated_at ON sprints;
CREATE TRIGGER trg_sprints_updated_at
    BEFORE UPDATE ON sprints
    FOR EACH ROW EXECUTE PROCEDURE _set_updated_at();
