# 🚀 Guía de despliegue en Railway

Este documento te guía paso a paso para desplegar el backend en Railway.

## 1. Preparación previa

### a) Crear cuenta en Railway (si no tienes)
- Ir a https://railway.app
- Registrarte con GitHub, GitLab o correo
- Validar correo si es necesario

### b) Conectar tu repo GitHub
- En Railway dashboard → New Project
- Opción: "Deploy from GitHub repo"
- Selecciona tu repo: `martinaguirrelan/Dashboard-Agile-2026`
- Autoriza Railway para acceder a GitHub

## 2. Crear el servicio backend en Railway

### a) Iniciar proyecto
1. Haz clic en "New Project"
2. Selecciona "Deploy from GitHub repo"
3. Busca y elige `Dashboard-Agile-2026`
4. Railway desplegará el servicio

### b) **⚠️ IMPORTANTE - Configurar root directory**
1. En Railway Dashboard → Abre tu proyecto → Servicio "backend"
2. Ve a la pestaña **Settings** (engranaje)
3. Busca **"Root Directory"** 
4. Cambia de `/` a `backend/`
5. Haz clic **Save**
6. Railway automáticamente reiniciará el build con la configuración correcta

> **Por qué:** Tu repo es un monorepo con carpetas `backend/` y `frontend/`. Railway necesita saber que el código Python está en `backend/`.

### c) Archivos de configuración para Railpack
Los siguientes archivos ayudan a Railpack (el builder de Railway) a detectar automáticamente tu proyecto Python:

- **`backend/railway.toml`** — Instrucciones explícitas de build y start
- **`backend/pyproject.toml`** — Metadata del proyecto Python
- **`backend/requirements.txt`** — Dependencias (ya existía)

Estos archivos **ya han sido creados automáticamente** en tu rama. Railway los usará para:
1. Detectar que es un proyecto Python/FastAPI
2. Ejecutar `pip install -r requirements.txt`
3. Iniciar con `bash start.sh`

### b) Configurar variables de entorno
Una vez creado el proyecto, necesitas agregar variables de entorno:

**En Railway Dashboard:**
1. Abre el proyecto creado
2. Haz clic en el servicio backend
3. Ve a la sección "Variables" 
4. Haz clic en "Add Variable" y agrega CADA UNA:

```
DATABASE_URL = postgresql://postgres:[PASSWORD]@db.xxxxxxxxxxxxxxxxxxxx.supabase.co:5432/postgres
SUPABASE_URL = https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_KEY = your-service-role-key
JWT_SECRET = [Generar con: python -c "import secrets; print(secrets.token_hex(32))"]
JWT_EXPIRE_HOURS = 24
ADMIN_USERNAME = admin
ADMIN_PASSWORD_HASH = $2b$12$... [Tu hash bcrypt actual]
USE_SUPABASE_STORAGE = true
SUPABASE_STORAGE_BUCKET = vouchers
JIRA_API_TOKEN = [Tu token Jira]
JIRA_USER_EMAIL = [Tu email Jira]
JIRA_BASE_URL = https://your-org.atlassian.net
JIRA_FIELD_START_DATE = customfield_10015
POLLING_INTERVAL_MIN = 30
DEBUG = false
PORT = 8000
```

> **Nota:** Copia las variables de tu `.env` local actual. Las que tienen prefijo "your-" o "xxx" reemplázalas con valores reales.

## 3. Conectar la base de datos (Supabase)

### Opción A: Usa PostgreSQL existente (recomendado)
Si ya tienes la base en Supabase:
1. Solo asegúrate que `DATABASE_URL` en Railway apunta correctamente a tu Supabase
2. Railway no crear una BD nueva, solo usa la conexión que le pases

### Opción B: Agregar PostgreSQL de Railway (alternativo)
Si quieres usar la BD que ofrece Railway:
1. En Railway Dashboard → "+ Add Database"
2. Selecciona "PostgreSQL"
3. Railway creará automáticamente una variable `DATABASE_URL`
4. Necesitarás migrar tu esquema (ver sección 4)

**⚠️ Para este proyecto recomiendo Opción A** (mantener Supabase) porque ya tienes datos.

## 4. Deploy automático

Una vez configuradas las variables:

1. Railway detecta cambios en `feat/epicas-1-2-implementacion` (o rama que pushees)
2. Inicia automáticamente un build
3. Ejecuta `bash start.sh` que valida imports e inicia uvicorn
4. En 2-3 minutos estará online

**Para que inicie el deploy:**
```bash
git push origin feat/epicas-1-2-implementacion
```

**Ver progreso:**
- En Railway → Proyecto → "Deployments" tab
- Puedes ver logs en tiempo real

## 5. Verificar que funciona

### a) Obtener URL pública
En Railway Dashboard:
- Abre el servicio backend
- Sección "Deployments" → Tu último deploy
- Copia la URL (ej: `https://dashboard-agile-2026-production.up.railway.app`)

### b) Testear endpoints
```bash
# Health check
curl https://dashboard-agile-2026-production.up.railway.app/health

# Login (si lo tienes)
curl -X POST https://dashboard-agile-2026-production.up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"tu_password"}'
```

### c) Ver logs en vivo
En Railway → Servicio backend → Logs tab

## 6. Próximos pasos

### Actualizar frontend
En tu `frontend/` actualiza la URL de API:
```javascript
// frontend/src/api/axios-config.js (o similar)
const API_BASE_URL = 'https://dashboard-agile-2026-production.up.railway.app'
```

Luego deploya frontend en Vercel (como hacías antes).

### Sincronización Jira
La sincronización automática empezará inmediatamente en Railway gracias a APScheduler en `app/main.py`.

Ver que está corriendo en logs:
```
INFO: JIRA sync scheduler started
INFO: Background sync task running...
```

## 7. Troubleshooting

### Build falla con error de imports
- Revisa el log completo en Railway
- Asegúrate que `requirements.txt` está actualizado
- Comprueba que todas las variables de entorno están presentes

### Conexión a BD rechazada
- Verifica `DATABASE_URL` es correcta
- En Supabase: Settings → Database → Connection string → cópia URI exacta
- Asegúrate que tu IP (Railway) no está bloqueada en Supabase firewall

### App inicia pero devuelve errores 500
- Ve a Railway Logs y busca "error" o "traceback"
- Verifica `JWT_SECRET`, `ADMIN_PASSWORD_HASH` son válidos
- Revisa que Supabase esté disponible

### Comparar con Render (lo viejo)
Si tienes dudas cómo se veía en Render, la estructura en Railway es casi idéntica:
- Mismo `Procfile` ✅
- Mismo `requirements.txt` ✅
- Mismo manejo de variables de entorno ✅
- Railway simplemente es más rápido y confiable

## 8. Costo de Railway

Railway ofrece:
- **$5 USD/mes** crédito gratuito (debería bastar para tu backend)
- Después: ~$0.09/hora por dyno (similar a Render)
- Puedes monitorear en Settings → Usage

## Checklist antes de push

- [ ] Root directory en Railway configurado a `backend/`
- [ ] Variables de entorno copiadas a Railway
- [ ] `DATABASE_URL` apunta a Supabase
- [ ] `requirements.txt` actualizado
- [ ] `.env` local tiene todos los secrets correctos
- [ ] Hiciste push a tu rama (no a main)
- [ ] `railway.json` en raíz del repo (ya creado)
- [ ] `backend/railway.toml` con build/start commands (ya creado)
- [ ] `backend/pyproject.toml` con metadata Python (ya creado)

¡Listo! Una vez completes estos pasos, tu backend estará corriendo en Railway. 🎉
