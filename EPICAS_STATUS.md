# Estado de Implementación de Épicas - Dashboard Agile 2026

## ✅ Épica 3: Matriz VP × T-Shirt (COMPLETADA)
- **PR**: #37 (MERGED)
- **Endpoints**: 
  - `GET /api/metrics/capacidad-vp?quarter=Q2-2026` → [{vp, iniciativas_s/m/l/xl, total, formato}]
  - `GET /api/metrics/matriz-vp-tshirt?quarter=Q2-2026` → [{vp, tamanio, cantidad}]
- **Status**: Desplegada en Render ✅
- **Descripción**: Matriz de distribución de tamaños por VP usando datos existentes

---

## 🔧 Épicas 1 y 2: PREPARACIÓN COMPLETADA
- **PR**: #38 (En Review)
- **Status**: Infraestructura lista, ORM y schemas definidos

### Cambios Realizados

#### Base de Datos (sync_schema.sql)
```sql
-- Tabla trimestres
CREATE TABLE trimestres (
    quarter, anio, numero, fecha_inicio, fecha_fin, descripcion
);
-- Seed: Q1-Q4 2026

-- Tabla sprints
CREATE TABLE sprints (
    sprint_key, sprint_name, numero, project_key, 
    fecha_inicio, fecha_fin, estado, descripcion
);
-- Seed: 4 sprints × 2 proyectos (SQP, SQV) Q2-2026
```

#### ORM Models (models/jira_epic.py)
- `Trimestre(id, quarter, anio, numero, fecha_inicio, fecha_fin, ...)`
- `Sprint(id, sprint_key, sprint_name, numero, project_key, fecha_inicio, fecha_fin, estado, ...)`

#### Schemas (schemas/jira_epic.py)
- `TrimestreOut` → Serialización JSON para respuestas
- `SprintOut` → Serialización JSON para respuestas

#### Router Reference (routers/reference.py)
```
GET /reference/trimestres?year=2026
GET /reference/sprints?project_key=SQP&estado=active
GET /reference/trimestres/{quarter}
GET /reference/sprints/{sprint_key}
```

---

## 📋 Próximos Pasos

### Épica 1: Lead Time por Sprint
**Requisitos**: ✅ Tabla sprints, ✅ ORM, ✅ Schemas

**Lógica de cálculo**:
```
Para cada sprint:
  lead_time = fecha_fin - fecha_inicio
  epicas_completadas = COUNT(jira_epics WHERE sprint_fin = sprint_key AND estado = 'Done')
  tiempo_promedio_por_epi ca = (SUM(fecha_done - fecha_inicio) / COUNT(epicas)) 
```

**Endpoint esperado**:
```
GET /api/metrics/lead-time-sprint?project_key=SQP
→ [{sprint_key, sprint_name, lead_time_days, epicas_completadas, avg_time}]
```

**Archivo a crear**: `backend/app/routers/epicas1.py`

---

### Épica 2: Iniciativas Agregadas (Scope Creep)
**Requisitos**: ✅ Tabla trimestres, ✅ ORM, ✅ Schemas

**Lógica de cálculo**:
```
Para cada trimestre:
  baseline_size = estimacion_inicial de épicas en este trimestre
  final_size = estimacion_final de épicas en este trimestre
  scope_creep_pct = ((final_size - baseline_size) / baseline_size) × 100
  
  Agrupar por trimestre y mostrar:
  - Total iniciativas
  - Tamaño inicial vs final
  - % de scope creep
  - Desglose por VP
```

**Endpoint esperado**:
```
GET /api/metrics/scope-creep?year=2026
→ [{quarter, total_iniciativas, baseline_size, final_size, scope_creep_pct, por_vp: []}]
```

**Archivo a crear**: `backend/app/routers/epicas2.py`

---

## 📊 Arquitectura Resumen

```
Backend Stack:
├── Sync Service (Jira → Supabase)
│   └── ORM: JiraEpic, ConfigProject, SyncLog, SyncMetric
├── Metrics Router (Épica 3) ✅
│   └── Capacidad por VP y T-shirt size
├── Reference Router (Trimestres y Sprints) 🔧
│   └── Datos de lookup para Épicas 1 y 2
├── Épicas 1 Router (Lead Time)
│   └── Análisis por sprint
└── Épicas 2 Router (Scope Creep)
    └── Análisis por trimestre

Database Schema:
├── config_projects (vp)
├── jira_epics (estimacion_inicial, estimacion_final, fecha_done, sprint_fin, etc.)
├── trimestres (quarter, fecha_inicio, fecha_fin)
├── sprints (sprint_key, project_key, fecha_inicio, fecha_fin, estado)
├── sync_logs (auditoría)
└── sync_metrics (agregación diaria)
```

---

## 🚀 Orden de Implementación Sugerido

1. **Merge PR #38** (Infraestructura preparada)
2. **Épica 1**: Lead Time por Sprint
   - Tiempo estimado: 2-3 horas
   - Endpoint GET /metrics/lead-time-sprint
3. **Épica 2**: Scope Creep / Iniciativas Agregadas  
   - Tiempo estimado: 2-3 horas
   - Endpoint GET /metrics/scope-creep

---

## ✨ Validación Actual

- ✅ Épica 3 funcional en producción
- ✅ Base de datos sincronizando correctamente (2.84s promedio, 0% error)
- ✅ Infraestructura ORM y schemas lista para Épicas 1 y 2
- ✅ Router reference funcional con endpoints de lookup
- ⏳ PR #38 pendiente de merge (Vercel checks en progreso)

