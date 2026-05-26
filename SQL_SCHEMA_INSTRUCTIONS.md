# 🗄️ Instrucciones para Crear Tablas en Supabase

## Estado Actual
✅ Código desplegado en Render  
✅ Endpoints `/reference/trimestres` y `/reference/sprints` activos  
❌ Tablas aún NO existen en Supabase

## Qué Necesita Hacerse

### Opción 1: Ejecutar SQL en Supabase Editor (Recomendado)

1. **Abre Supabase Console**
   - Ve a https://supabase.com/
   - Ingresa a tu proyecto Dashboard Agile 2026
   - Click en "SQL Editor"

2. **Copia el SQL completo**
   - Archivo: `backend/sync_schema.sql` (en la rama main)
   - O usa el contenido de abajo

3. **Pega en SQL Editor y ejecuta**
   - Verás las instrucciones CREATE TABLE
   - Click "Run"

4. **Verifica**
   ```bash
   curl -s https://dashboard-agile-2026.onrender.com/api/reference/trimestres | jq .
   # Debe retornar: [{"quarter": "Q1-2026", ...}, ...]
   ```

---

### SQL a Ejecutar (Copiar y Pegar)

```sql
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

-- 7. Triggers para updated_at automático
DROP TRIGGER IF EXISTS trg_trimestres_updated_at ON trimestres;
CREATE TRIGGER trg_trimestres_updated_at
    BEFORE UPDATE ON trimestres
    FOR EACH ROW EXECUTE PROCEDURE _set_updated_at();

DROP TRIGGER IF EXISTS trg_sprints_updated_at ON sprints;
CREATE TRIGGER trg_sprints_updated_at
    BEFORE UPDATE ON sprints
    FOR EACH ROW EXECUTE PROCEDURE _set_updated_at();
```

---

## Después de Ejecutar el SQL

### 1. Verificar que se crearon las tablas
```bash
curl -s https://dashboard-agile-2026.onrender.com/api/reference/trimestres | jq .
```

**Esperado:**
```json
[
  {
    "id": "...",
    "quarter": "Q1-2026",
    "anio": 2026,
    "numero": 1,
    "fecha_inicio": "2026-01-01",
    "fecha_fin": "2026-03-31",
    ...
  },
  ...
]
```

### 2. Verificar sprints
```bash
curl -s https://dashboard-agile-2026.onrender.com/api/reference/sprints | jq .
```

**Esperado:** Array con 8 sprints (4 SQP + 4 SQV)

### 3. Ejecutar validación completa
```bash
cd /Users/martinaguirrelan/Desktop/PROY\ CON\ CLAUDE/Dashboard\ Agile\ 2026
./validate_deployment.sh
```

---

## Solución de Problemas

### ¿La tabla ya existe?
Si ejecutas el SQL y ves error:
```
ERROR: relation "trimestres" already exists
```

Es normal, las tablas son idempotentes (CREATE TABLE IF NOT EXISTS)

### ¿Los datos no aparecen?
```bash
# Verifica que se insertó el seed
curl -s https://dashboard-agile-2026.onrender.com/api/reference/trimestres | jq '. | length'
```

Si devuelve `0`, el INSERT no funcionó. Verifica:
1. La tabla existe: `SELECT * FROM trimestres;` en Supabase
2. Si está vacía, ejecuta solo el INSERT de nuevo

---

## Próximos Pasos

Una vez que las tablas estén creadas y pobladas:

1. ✅ Ejecutar SQL schema en Supabase
2. ✅ Verificar que los endpoints retornan datos
3. 🔨 Implementar Épica 1: Lead Time por Sprint
4. 🔨 Implementar Épica 2: Scope Creep
5. 🎨 Crear componentes React para visualización

