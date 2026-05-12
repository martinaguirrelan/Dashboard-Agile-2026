#!/bin/bash
set -e

echo "=== STARTUP DIAGNOSTIC ==="
echo "Python: $(python --version)"
echo "Working dir: $(pwd)"
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo YES || echo NO)"
echo "JWT_SECRET set: $([ -n "$JWT_SECRET" ] && echo YES || echo NO)"
echo "=========================="

echo "Testing imports..."
python -c "
import sys
print('sys.path:', sys.path[:3])
try:
    from app.config import settings
    print('config OK - DB URL prefix:', settings.database_url[:20])
except Exception as e:
    print('FAIL config:', e)
    sys.exit(1)
try:
    from app.database import engine
    print('database OK')
except Exception as e:
    print('FAIL database:', e)
    sys.exit(1)
try:
    from app.main import app
    print('main OK')
except Exception as e:
    print('FAIL main:', e)
    sys.exit(1)
print('All imports OK')
"

echo "Starting uvicorn..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
