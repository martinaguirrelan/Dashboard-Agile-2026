# Mi App — Template Full-Stack

Template listo para producción con React + FastAPI + Supabase.

| Capa       | Tecnología            | Despliegue |
|------------|-----------------------|------------|
| Frontend   | React 18 + Vite 5     | Vercel     |
| Backend    | FastAPI + SQLAlchemy  | Render     |
| Base datos | PostgreSQL            | Supabase   |
| Storage    | Supabase Storage      | Supabase   |
| Auth       | JWT (python-jose)     | —          |

---

## Estructura del proyecto

```
.
├── backend/
│   ├── app/
│   │   ├── main.py          # Entrada FastAPI, CORS, routers
│   │   ├── config.py        # Variables de entorno (pydantic-settings)
│   │   ├── database.py      # SQLAlchemy engine + session
│   │   ├── models/          # Modelos ORM (tablas)
│   │   ├── routers/         # Endpoints por recurso
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   └── services/        # Lógica de negocio
│   ├── requirements.txt
│   ├── runtime.txt          # python-3.11
│   ├── Procfile             # Render start command
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/             # Llamadas HTTP (axios)
    │   │   ├── client.js    # Instancia axios + interceptors JWT
    │   │   └── auth.js
    │   ├── components/
    │   │   └── Layout/
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── HomePage.jsx
    │   │   └── LoginPage.jsx
    │   ├── utils/
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    ├── package.json
    ├── vite.config.js       # Proxy /api → localhost:8000 en dev
    └── vercel.json          # Rewrite SPA para React Router
```

---

## Setup local

### 1. Clonar y configurar el backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Editar .env con tus credenciales de Supabase
uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- Docs Swagger: `http://localhost:8000/api/docs`

### 2. Configurar el frontend

```bash
cd frontend
npm install
# .env.local NO es necesario en desarrollo (Vite proxy maneja /api)
npm run dev
```

- App: `http://localhost:5173`

---

## Variables de entorno

### `backend/.env`

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your-service-role-key
JWT_SECRET=genera-uno-con-secrets.token_hex(32)
JWT_EXPIRE_HOURS=24
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$12$...hash-bcrypt...
USE_SUPABASE_STORAGE=true
SUPABASE_STORAGE_BUCKET=vouchers
DEBUG=false
```

Generar JWT_SECRET:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Generar ADMIN_PASSWORD_HASH:
```bash
python -c "import bcrypt; print(bcrypt.hashpw(b'tu_password', bcrypt.gensalt()).decode())"
```

### `frontend/.env.local` (solo producción)

```env
VITE_API_URL=https://tu-api.onrender.com
```

---

## Despliegue

### Supabase
1. Crear proyecto en [supabase.com](https://supabase.com)
2. Copiar **Connection string** → Settings → Database → URI
3. Crear bucket `vouchers` en Storage (marcar como público)
4. Copiar URL y Service Role Key → Settings → API

### Render (backend)
1. New Web Service → conectar repositorio GitHub
2. **Root Directory**: `backend`
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Agregar todas las variables de entorno del `.env.example`

### Vercel (frontend)
1. New Project → importar repositorio GitHub
2. **Root Directory**: `frontend`
3. **Framework Preset**: Vite
4. Variables de entorno: `VITE_API_URL` = URL del backend en Render

---

## Flujo de autenticación

```
Login form → POST /api/auth/login → JWT token
JWT guardado en localStorage → adjuntado en cada request (Authorization: Bearer)
Ruta protegida /admin → PrivateRoute verifica isAdmin (token presente)
401 del servidor → borra token + redirige a /login
```

---

## Agregar un nuevo recurso

1. **Modelo** → `backend/app/models/mi_recurso.py` (clase SQLAlchemy)
2. **Schema** → `backend/app/schemas/mi_recurso.py` (Pydantic in/out)
3. **Router** → `backend/app/routers/mi_recurso.py` (endpoints)
4. **Registrar** → importar en `app/routers/__init__.py` y `app/main.py`
5. **Frontend** → `frontend/src/api/mi_recurso.js` + página/componente
