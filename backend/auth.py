from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import AuthorizedUser

bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser:
    def __init__(self, email: str, name: str, is_authorized: bool):
        self.email = email
        self.name = name
        self.is_authorized = is_authorized


def create_access_token(email: str, name: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=settings.jwt_expires_hours)
    payload = {"sub": email, "name": name, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


def is_authorized_email(db: Session, email: str) -> bool:
    return (
        db.query(AuthorizedUser).filter(AuthorizedUser.email == email).first()
        is not None
    )


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[CurrentUser]:
    if credentials is None:
        return None
    payload = _decode_token(credentials.credentials)
    email = payload.get("sub")
    name = payload.get("name", "")
    if not email:
        return None
    return CurrentUser(email=email, name=name, is_authorized=is_authorized_email(db, email))


def get_current_user(
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
) -> CurrentUser:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user


def require_authorized(
    user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    if not user.is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authorized user only",
        )
    return user
