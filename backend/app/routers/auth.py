from fastapi import APIRouter, HTTPException, status
from ..schemas.user import LoginRequest, Token
from ..services.auth_service import authenticate_admin, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(body: LoginRequest):
    if not authenticate_admin(body.username, body.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )
    token = create_access_token({"sub": body.username})
    return Token(access_token=token, username=body.username)
