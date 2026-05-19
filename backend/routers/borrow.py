from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_authorized, CurrentUser
from database import get_db
from models import Asset, AssetStatus, BorrowRecord
from schemas import BorrowCreate, BorrowOut

router = APIRouter(prefix="/api/borrow", tags=["borrow"])


@router.get("", response_model=List[BorrowOut])
def list_borrow(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    query = db.query(BorrowRecord)
    if not user.is_authorized:
        query = query.filter(BorrowRecord.borrower_email == user.email)
    return query.order_by(BorrowRecord.borrowed_at.desc()).all()


@router.post("", response_model=BorrowOut, status_code=status.HTTP_201_CREATED)
def create_borrow(
    payload: BorrowCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if asset.status != AssetStatus.available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Asset is not available (status={asset.status.value})",
        )

    record = BorrowRecord(
        asset_id=asset.id,
        borrower_email=user.email,
        borrower_name=user.name,
        borrowed_at=datetime.utcnow(),
        due_at=payload.due_at,
    )
    asset.status = AssetStatus.borrowed
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{record_id}/return", response_model=BorrowOut)
def mark_returned(
    record_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_authorized),
):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrow record not found")
    if record.returned_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Already returned"
        )

    record.returned_at = datetime.utcnow()
    asset = db.query(Asset).filter(Asset.id == record.asset_id).first()
    if asset:
        other_open = (
            db.query(BorrowRecord)
            .filter(
                BorrowRecord.asset_id == asset.id,
                BorrowRecord.id != record.id,
                BorrowRecord.returned_at.is_(None),
            )
            .first()
        )
        if not other_open:
            asset.status = AssetStatus.available

    db.commit()
    db.refresh(record)
    return record
