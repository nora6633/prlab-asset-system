import enum
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from database import Base


class AssetStatus(str, enum.Enum):
    available = "available"
    borrowed = "borrowed"
    retired = "retired"


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    asset_no = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    alias = Column(String(255), nullable=True)
    model = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    status = Column(
        Enum(AssetStatus, name="asset_status"),
        nullable=False,
        default=AssetStatus.available,
    )
    quantity = Column(Integer, nullable=False, default=1)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    borrow_records = relationship(
        "BorrowRecord", back_populates="asset", cascade="all, delete-orphan"
    )


class BorrowRecord(Base):
    __tablename__ = "borrow_records"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    borrower_email = Column(String(255), nullable=False, index=True)
    borrower_name = Column(String(255), nullable=False)
    borrowed_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    due_at = Column(DateTime, nullable=True)
    returned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    asset = relationship("Asset", back_populates="borrow_records")


class AuthorizedUser(Base):
    __tablename__ = "authorized_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    added_by = Column(String(255), nullable=False)
    added_at = Column(DateTime, nullable=False, default=datetime.utcnow)
