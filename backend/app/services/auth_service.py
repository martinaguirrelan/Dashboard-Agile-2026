from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import bcrypt

from ..config import settings

bearer_scheme = HTTPBearer()


def authenticate_admin(username: str, password: str) -> bool:
    if username != settings.admin_username:
        return False
    pw_bytes = password.encode("utf-8")
    hash_bytes = settings.admin_password_hash.encode("utf-8")
    return bcrypt.checkpw(pw_bytes, hash_bytes)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    payload["exp"] = expire
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def require_admin(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    try:
        jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )
