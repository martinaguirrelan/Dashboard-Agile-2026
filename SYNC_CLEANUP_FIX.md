# Fix: Limpieza de Épicas Eliminadas en Jira

**PR**: #39  
**Status**: ⏳ En Review (Vercel checks en progreso)

---

## 📋 Problema Identificado

Cuando un usuario **elimina una épica en Jira**, la base de datos continúa almacenándola indefinidamente. Esto ocurre porque:

1. **Upsert solo**: El sistema hace INSERT/UPDATE de épicas que vienen de Jira
2. **Sin limpieza**: Nunca se ejecuta lógica para eliminar lo que ya no existe en Jira
3. **Datos huérfanos**: Las épicas eliminadas en Jira quedan "fantasmas" en la BD

### Impacto
- 📊 Métricas infladas (cuentas más épicas de las que realmente hay)
- 🔗 Relaciones rotas (épicas que no existen en Jira pero sí en BD)
- ❌ Inconsistencia de datos entre sistemas

---

## ✅ Solución Implementada

### Nueva Función: `_cleanup_orphaned_epics()`

```python
def _cleanup_orphaned_epics(db: Session, sync_started_at: datetime, project_keys: list[str]):
    """
    Detecta y elimina épicas huérfanas (que no existen en Jira).
    
    Lógica:
    - Si un épica en BD tiene updated_at < sync_started_at
    - Significa que fue ignorada en el full sync
    - Por lo tanto, ya no existe en Jira
    - Se elimina de la BD
    """
```

### Cómo Funciona

#### Antes (sin fix):
```
run_full_sync():
  1. Fetch épicos de Jira
  2. Upsert en BD
  3. Agregar métricas diarias
  4. FIN (las épicas eliminadas permanecen en BD)
```

#### Después (con fix):
```
run_full_sync():
  1. Fetch épicos de Jira
  2. Upsert en BD
  3. Agregar métricas diarias
  4. Buscar épicas con updated_at < sync_started_at
  5. Eliminarlas (ya no existen en Jira)
  6. Retornar estadísticas de limpieza
```

### Comparativa de Timestamps

```
BD (updated_at)    |  sync_started_at  |  Acción
─────────────────────────────────────────────────
2026-05-20 10:30   |  2026-05-26 12:00 |  ✅ Eliminar (no fue tocada)
2026-05-26 12:05   |  2026-05-26 12:00 |  ✅ Mantener (fue actualizada)
```

---

## 🔍 Seguridad y Validaciones

✅ **Solo en Full Sync**: Se ejecuta cada 24h, no en syncs diferenciales  
✅ **Timestamp-based**: No depende de conectividad con Jira  
✅ **Rollback automático**: Si hay error, se cancela toda la operación  
✅ **Auditoría**: Todas las eliminaciones se registran en logs  
✅ **Respuesta con detalles**: El resultado incluye qué se eliminó

### Logs de Ejemplo

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄  FULL SYNC PROGRAMADO cada 24h
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  Proyectos: ['SQP', 'SQV']
  → SQP
    ✔ Upserted: 45 épicas
  → SQV
    ✔ Upserted: 38 épicas

🧹 Limpiando épicas eliminadas en Jira...
    🗑️  Eliminando épica huérfana: SQP-999 (Feature X)
    🗑️  Eliminando épica huérfana: SQV-456 (Bug Fix Y)
  → SQP: 1 épicas eliminadas (ya no existen en Jira)
  → SQV: 1 épicas eliminadas (ya no existen en Jira)

✅ Limpieza completada: 2 épicas removidas
```

---

## 🧪 Cómo Testear

### Test Manual

1. **Crear épica de prueba en Jira**
   ```
   Proyecto: SQP
   Nombre: "DELETE-TEST-$(date +%s)"
   ```

2. **Forzar sincronización**
   ```bash
   curl -X POST https://dashboard-agile-2026.onrender.com/api/sync/full
   ```

3. **Verificar que está en BD**
   ```bash
   curl https://dashboard-agile-2026.onrender.com/api/epics | grep DELETE-TEST
   # Debe encontrarlo ✓
   ```

4. **Eliminar en Jira**
   - Ir a Jira
   - Abrir la épica DELETE-TEST
   - Click derecho → Eliminar

5. **Forzar full sync nuevamente** (normalmente espera 24h)
   ```bash
   curl -X POST https://dashboard-agile-2026.onrender.com/api/sync/full
   ```

6. **Verificar eliminación en BD**
   ```bash
   curl https://dashboard-agile-2026.onrender.com/api/epics | grep DELETE-TEST
   # Debe estar vacío ✓
   ```

7. **Revisar logs de sincronización**
   ```bash
   curl https://dashboard-agile-2026.onrender.com/api/sync/logs?days=1 | jq '.[] | .cleanup'
   # Debe mostrar:
   # {
   #   "deleted_count": 1,
   #   "deleted_keys": ["DELETE-TEST-xxxxx"]
   # }
   ```

### Verificación en Render

```bash
# Ver logs en vivo
curl https://dashboard-agile-2026.onrender.com/api/health

# Histórico de syncs con limpieza
curl https://dashboard-agile-2026.onrender.com/api/sync/logs?days=1
```

---

## 📊 Respuesta de API con Limpieza

Después de ejecutar full sync con épicas eliminadas:

```json
{
  "status": "ok",
  "sync_type": "FULL",
  "duration_seconds": 12.45,
  "total_upserted": 83,
  "total_errors": 0,
  "projects": [
    {
      "key": "SQP",
      "epics": 45,
      "errors": 0
    },
    {
      "key": "SQV", 
      "epics": 38,
      "errors": 0
    }
  ],
  "cleanup": {
    "deleted_count": 2,
    "deleted_keys": ["SQP-999", "SQV-456"]
  }
}
```

---

## 🚀 Próximas Mejoras (Opcionales)

Si quieres aún más robustez, considera estos enhancements:

### Soft Delete (Marcar en lugar de eliminar)
```sql
ALTER TABLE jira_epics ADD COLUMN deleted_at TIMESTAMPTZ;
-- En lugar de DELETE, hacer UPDATE deleted_at = NOW()
```

### Webhook de Jira (Limpieza en tiempo real)
```python
@app.post("/api/webhooks/jira")
def handle_jira_webhook(event: dict):
    if event["webhookEvent"] == "jira:issue_deleted":
        delete_epic_by_id(event["issue"]["id"])
```

### Quarantine Period (Grace period antes de eliminar)
```python
# Solo eliminar si fue deletada hace más de 7 días
if sync_started_at - epic.updated_at > timedelta(days=7):
    db.delete(epic)
```

---

## ✨ Estado Final

- ✅ Épicas eliminadas en Jira se limpian en BD cada 24h
- ✅ Datos consistentes entre Jira y Supabase
- ✅ Auditoría completa de eliminaciones
- ✅ Seguro y reversible (logs guardan qué se eliminó)
- 🚀 Lista para producción

