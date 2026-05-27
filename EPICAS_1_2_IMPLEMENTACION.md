# Épicas 1 & 2: Implementación Completada

**Estado:** ✅ Implementación código completada | ⏳ Testing pendiente en Supabase  
**Fecha:** 2026-05-26

---

## Épica 1: Lead Time por Sprint

### Descripción
Calcula y analiza el tiempo que tarda una épica desde su inicio (`start_date`) hasta su completación (`fecha_done`), agrupado por sprint.

### Endpoint
```
GET /api/metrics/lead-time-sprint
```

### Query Parameters
- `sprint_key` (opcional): Filtrar por sprint específico (ej. `SQP-Sprint-23`)
- `project_key` (opcional): Filtrar por proyecto (ej. `SQP`, `SQV`)
- `quarter` (opcional, default: `Q2-2026`): Trimestre para contexto

### Respuesta
```json
[
  {
    "sprint_key": "SQP-Sprint-23",
    "sprint_name": "Sprint 23",
    "epics_completed": 5,
    "avg_lead_time_days": 14.2,
    "min_lead_time_days": 7,
    "max_lead_time_days": 21
  }
]
```

### Campos
- **sprint_key**: Identificador del sprint (ej. "SQP-Sprint-23")
- **sprint_name**: Nombre legible del sprint
- **epics_completed**: Cantidad de épicas completadas (status=Done y fecha_done NOT NULL)
- **avg_lead_time_days**: Promedio de días entre start_date y fecha_done
- **min_lead_time_days**: Mínimo lead time en días
- **max_lead_time_days**: Máximo lead time en días

### Filtros Aplicados Automáticamente
- Solo épicas con `status == "Done"`
- Solo épicas con `fecha_done` NO NULL
- Solo épicas con `sprint_fin` definido
- Trimestre específico (Q2-2026 por default)

### Ejemplo de Uso

```bash
# Obtener lead time para todos los sprints del Q2-2026
curl -s https://dashboard-agile-2026.onrender.com/api/metrics/lead-time-sprint?quarter=Q2-2026 | jq .

# Filtrar por un sprint específico
curl -s https://dashboard-agile-2026.onrender.com/api/metrics/lead-time-sprint?sprint_key=SQP-Sprint-23 | jq .

# Filtrar por proyecto
curl -s https://dashboard-agile-2026.onrender.com/api/metrics/lead-time-sprint?project_key=SQP | jq .
```

### Casos de Uso
- **Benchmarking**: Comparar lead time entre sprints
- **Predictabilidad**: Identificar sprints más rápidos/lentos
- **Capacity Planning**: Ajustar velocidad basado en histórico
- **SLA Tracking**: Monitorear cumplimiento de deadlines

---

## Épica 2: Iniciativas Agregadas / Scope Creep

### Descripción
Analiza la variación entre la estimación inicial y final de épicas, agrupado por VP y trimestre. Detecta "scope creep" (expansión no planificada del alcance).

### Endpoint
```
GET /api/metrics/scope-creep
```

### Query Parameters
- `quarter` (optional, default: `Q2-2026`): Trimestre a analizar

### Respuesta
```json
[
  {
    "vp": "MDA",
    "total_initiatives": 8,
    "initiatives_with_estimation": 7,
    "baseline_size_total": 16,
    "final_size_total": 18,
    "scope_creep_percentage": 12.5,
    "scope_creep_status": "moderate"
  }
]
```

### Campos
- **vp**: Nombre del VP (ej. "MDA", "MLP", "Data Platform")
- **total_initiatives**: Total de épicas del VP en el trimestre
- **initiatives_with_estimation**: Épicas con ambas estimaciones (inicial y final)
- **baseline_size_total**: Suma de `estimacion_inicial` (convertida a puntos)
- **final_size_total**: Suma de `estimacion_final` (convertida a puntos)
- **scope_creep_percentage**: Variación porcentual = (final - baseline) / baseline * 100
- **scope_creep_status**: Clasificación:
  - `"within_bounds"`: < 10% creep (aceptable)
  - `"moderate"`: 10-20% creep (requiere atención)
  - `"exceeded"`: > 20% creep (problema significativo)

### Conversión T-Shirt a Puntos
Las estimaciones T-shirt se convierten a puntos para agregación:
- S → 1 punto
- M → 2 puntos
- L → 3 puntos
- XL → 4 puntos

### Ejemplo de Uso

```bash
# Obtener scope creep para Q2-2026
curl -s https://dashboard-agile-2026.onrender.com/api/metrics/scope-creep?quarter=Q2-2026 | jq .

# Obtener scope creep para Q1-2026
curl -s https://dashboard-agile-2026.onrender.com/api/metrics/scope-creep?quarter=Q1-2026 | jq .

# Con jq, filtrar solo VPs con scope_creep_status="exceeded"
curl -s https://dashboard-agile-2026.onrender.com/api/metrics/scope-creep?quarter=Q2-2026 | \
  jq '.[] | select(.scope_creep_status == "exceeded")'
```

### Casos de Uso
- **Planificación**: Detectar cambios de alcance temprano
- **Métricas de Calidad**: Monitorear estabilidad de estimaciones
- **Post-Mortem**: Analizar por qué ciertas iniciativas escalaron
- **Presupuesto**: Alinear gasto con trabajo realizado
- **Predictibilidad**: Mejorar precisión de estimaciones futuras

---

## Arquitectura de Implementación

### Archivos Modificados

#### 1. `backend/app/routers/metrics.py`
**Cambios:**
- Añadido endpoint `GET /metrics/lead-time-sprint` (~50 líneas)
- Añadido endpoint `GET /metrics/scope-creep` (~80 líneas)
- Ambos con query parameters, filtrado, y lógica de agregación

**Dependencias:**
- `sqlalchemy`: queries con GROUP BY, agregaciones
- `models.jira_epic`: JiraEpic, ConfigProject
- `schemas.jira_epic`: LeadTimeSprintOut, ScopeCreepOut

#### 2. `backend/app/schemas/jira_epic.py`
**Cambios:**
- Añadido `LeadTimeSprintOut` schema (~5 líneas)
- Añadido `ScopeCreepOut` schema (~7 líneas)
- Ambos con validación de tipos Pydantic

### Prerequisitos de Datos

Para que los endpoints devuelvan resultados no vacíos, la BD debe tener:

1. **Para Épica 1 (Lead Time)**:
   - Épicas con `status == "Done"`
   - Épicas con `fecha_done` poblado (fecha de completación)
   - Épicas con `sprint_fin` poblado (sprint donde se completó)
   - Épicas con `start_date` y `fecha_done` para calcular lead_time_days

2. **Para Épica 2 (Scope Creep)**:
   - Épicas con `estimacion_inicial` y `estimacion_final` (T-shirt sizes)
   - Épicas con `quarter` poblado (ej. "Q2-2026")
   - ConfigProject con `vp` poblado para cada proyecto activo

---

## Testing

### Pre-deployment (Local)

```bash
# 1. Verificar sintaxis de Python
python -m py_compile backend/app/routers/metrics.py
python -m py_compile backend/app/schemas/jira_epic.py

# 2. Ejecutar linter (si está configurado)
flake8 backend/app/routers/metrics.py
flake8 backend/app/schemas/jira_epic.py
```

### Post-deployment (Render + Supabase)

#### Prerequisito: Ejecutar SQL Schema en Supabase
Ver `SQL_SCHEMA_INSTRUCTIONS.md` para crear tablas en Supabase.

#### Test 1: Salud del Backend
```bash
curl -s https://dashboard-agile-2026.onrender.com/api/health | jq .
# Esperado: status="ok", db="conectada", scheduler="activo"
```

#### Test 2: Épica 1 - Lead Time por Sprint (Sin Datos)
```bash
curl -s https://dashboard-agile-2026.onrender.com/api/metrics/lead-time-sprint | jq .
# Esperado inicialmente: [] (vacío, esperar datos de Jira)
```

#### Test 3: Épica 1 - Con Filtro de Sprint
```bash
curl -s "https://dashboard-agile-2026.onrender.com/api/metrics/lead-time-sprint?sprint_key=SQP-Sprint-23" | jq .
# Esperado: [] o datos si hay épicas completadas en ese sprint
```

#### Test 4: Épica 2 - Scope Creep (Sin Datos)
```bash
curl -s https://dashboard-agile-2026.onrender.com/api/metrics/scope-creep | jq .
# Esperado inicialmente: [] (vacío, esperar datos de Jira)
```

#### Test 5: Épica 2 - Con Filtro de Trimestre
```bash
curl -s "https://dashboard-agile-2026.onrender.com/api/metrics/scope-creep?quarter=Q2-2026" | jq .
# Esperado: [] o datos con scope_creep_status
```

#### Test 6: Error Handling
```bash
# Parámetro inválido (quarter no existe)
curl -s "https://dashboard-agile-2026.onrender.com/api/metrics/scope-creep?quarter=Q9-2099" | jq .
# Esperado: [] (sin errores, query retorna vacío)

# Sprint_key no existe
curl -s "https://dashboard-agile-2026.onrender.com/api/metrics/lead-time-sprint?sprint_key=FAKE-Sprint-999" | jq .
# Esperado: [] (sin errores)
```

---

## Próximos Pasos

### 1. Ejecutar SQL Schema en Supabase (BLOQUEANTE)
```bash
# Ver instrucciones en SQL_SCHEMA_INSTRUCTIONS.md
# Crear tablas: trimestres, sprints, sync_logs, sync_metrics
```

### 2. Sincronizar Épicas desde Jira
```bash
# Dispara un full sync para traer épicas con estimaciones
curl -X POST https://dashboard-agile-2026.onrender.com/api/sync/full \
  -H "Authorization: Bearer <admin_token>"
```

### 3. Verificar Datos
```bash
# Chequear cuántas épicas tienen estimaciones y datos completos
curl -s https://dashboard-agile-2026.onrender.com/api/epics | \
  jq '[.[] | select(.estimacion_inicial != null)] | length'
```

### 4. Crear Componentes React
Una vez verificado que los datos llegan:
- `frontend/src/components/LeadTimeSprintChart.tsx` (gráfico de lead times)
- `frontend/src/components/ScopeCreepAnalysis.tsx` (análisis de scope creep)
- `frontend/src/pages/EpicasPage.tsx` (página con ambas épicas)

### 5. Dashboard Integration
- Agregar cards en el dashboard principal
- Integrar con filtros globales (quarter, project_key, VP)
- Agregar exportación a CSV para análisis offline

---

## Resolución de Problemas

### "No hay datos en el endpoint"
**Causa:** Épicas no sincronizadas desde Jira o faltan campos obligatorios  
**Solución:** Ejecutar `POST /sync/full` y esperar, luego chequear épicas en `/api/epics`

### "Scope creep muestra valores incorrectos"
**Causa:** Estimaciones en formato incorrecto (no T-shirt)  
**Solución:** Verificar que `estimacion_inicial` y `estimacion_final` sean [S, M, L, XL]

### "Lead time es negativo o cero"
**Causa:** `start_date` y `fecha_done` incorrectas o `lead_time_days` no calculado  
**Solución:** Revisar campos de fecha en Jira sync_service.py

### Endpoint retorna 500 Error
**Causa:** Error en query SQL o transformación de datos  
**Solución:** Revisar logs de Render: `https://dashboard.render.com/services/`

---

## Documentación Relacionada

- **Trimestres & Sprints:** `backend/app/routers/reference.py`
- **Sync Infrastructure:** `backend/app/services/sync_service.py`
- **Testing & Monitoring:** `backend/app/routers/sync.py`
- **Épica 3 (VP×T-Shirt):** `backend/app/routers/metrics.py` (get_capacidad_por_vp)

---

**Implementado por:** Claude  
**PR asociado:** #40 (pendiente crear)  
**Última actualización:** 2026-05-26
