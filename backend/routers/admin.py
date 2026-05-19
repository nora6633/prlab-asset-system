from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import CurrentUser, require_authorized
from database import get_db
from models import AuthorizedUser
from schemas import AuthorizedUserCreate, AuthorizedUserOut

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/authorized-users", response_model=List[AuthorizedUserOut])
def list_authorized_users(
    db: Session = Depends(get_db),
    _=Depends(require_authorized),
):
    return db.query(AuthorizedUser).order_by(AuthorizedUser.added_at.desc()).all()


@router.post(
    "/authorized-users",
    response_model=AuthorizedUserOut,
    status_code=status.HTTP_201_CREATED,
)
def add_authorized_user(
    payload: AuthorizedUserCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_authorized),
):
    if db.query(AuthorizedUser).filter(AuthorizedUser.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already authorized"
        )
    record = AuthorizedUser(email=payload.email, added_by=user.email)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/authorized-users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_authorized_user(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_authorized),
):
    record = db.query(AuthorizedUser).filter(AuthorizedUser.id == user_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Authorized user not found"
        )
    db.delete(record)
    db.commit()
    return None
