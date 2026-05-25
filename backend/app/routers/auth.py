from fastapi import APIRouter, HTTPException, status
from ..schemas.user import LoginRequest, Token
from ..services.auth_service import authenticate_admin, create_access_token
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/debug")
def debug_auth():
    """Debug endpoint - remove in production"""
    return {
        "admin_username": settings.admin_username,
        "admin_password_hash": settings.admin_password_hash[:20] + "..." if settings.admin_password_hash else "NOT SET",
        "hash_length": len(settings.admin_password_hash) if settings.admin_password_hash else 0,
    }


@router.post("/login", response_model=Token)
def login(body: LoginRequest):
    if not authenticate_admin(body.username, body.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )
    token = create_access_token({"sub": body.username})
    return Token(access_token=token, username=body.username)
