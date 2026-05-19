from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from models import AssetStatus


class AssetBase(BaseModel):
    asset_no: str
    name: str
    alias: Optional[str] = None
    model: Optional[str] = None
    location: Optional[str] = None
    status: AssetStatus = AssetStatus.available
    quantity: int = 1
    note: Optional[str] = None


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    asset_no: Optional[str] = None
    name: Optional[str] = None
    alias: Optional[str] = None
    model: Optional[str] = None
    location: Optional[str] = None
    status: Optional[AssetStatus] = None
    quantity: Optional[int] = None
    note: Optional[str] = None


class AssetOut(AssetBase):
    id: int
    created_at: datetime
    updated_at: datetime
    current_borrower: Optional[str] = None

    class Config:
        from_attributes = True


class BorrowCreate(BaseModel):
    asset_id: int
    due_at: Optional[datetime] = None


class BorrowOut(BaseModel):
    id: int
    asset_id: int
    borrower_email: str
    borrower_name: str
    borrowed_at: datetime
    due_at: Optional[datetime]
    returned_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class GoogleLoginRequest(BaseModel):
    token: str = Field(..., description="Google ID token")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str
    name: str
    is_authorized: bool


class AuthorizedUserCreate(BaseModel):
    email: EmailStr


class AuthorizedUserOut(BaseModel):
    id: int
    email: str
    added_by: str
    added_at: datetime

    class Config:
        from_attributes = True
