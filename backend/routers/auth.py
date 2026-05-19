from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session

from auth import create_access_token, is_authorized_email
from config import settings
from database import get_db
from schemas import GoogleLoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/google", response_model=LoginResponse)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        info = id_token.verify_oauth2_token(
            payload.token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google ID token: {exc}",
        ) from exc

    email = info.get("email")
    name = info.get("name") or email
    if not email or not info.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not verified by Google",
        )

    token = create_access_token(email=email, name=name)
    return LoginResponse(
        access_token=token,
        email=email,
        name=name,
        is_authorized=is_authorized_email(db, email),
    )
