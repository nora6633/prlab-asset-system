from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import require_authorized
from database import get_db
from models import Asset, AssetStatus, BorrowRecord
from schemas import AssetCreate, AssetOut, AssetUpdate

router = APIRouter(prefix="/api/assets", tags=["assets"])


def _attach_current_borrower(db: Session, asset: Asset) -> AssetOut:
    out = AssetOut.model_validate(asset)
    if asset.status == AssetStatus.borrowed:
        record: Optional[BorrowRecord] = (
            db.query(BorrowRecord)
            .filter(
                BorrowRecord.asset_id == asset.id,
                BorrowRecord.returned_at.is_(None),
            )
            .order_by(BorrowRecord.borrowed_at.desc())
            .first()
        )
        if record:
            out.current_borrower = record.borrower_name
    return out


@router.get("", response_model=List[AssetOut])
def list_assets(db: Session = Depends(get_db)):
    assets = db.query(Asset).order_by(Asset.asset_no).all()
    return [_attach_current_borrower(db, a) for a in assets]


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return _attach_current_borrower(db, asset)


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    payload: AssetCreate,
    db: Session = Depends(get_db),
    _=Depends(require_authorized),
):
    if db.query(Asset).filter(Asset.asset_no == payload.asset_no).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"asset_no '{payload.asset_no}' already exists",
        )
    asset = Asset(**payload.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return _attach_current_borrower(db, asset)


@router.put("/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id: int,
    payload: AssetUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_authorized),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    db.commit()
    db.refresh(asset)
    return _attach_current_borrower(db, asset)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_authorized),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    db.delete(asset)
    db.commit()
    return None
