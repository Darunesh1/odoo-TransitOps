from datetime import date, datetime, timezone
import enum
from typing import Optional, List
import uuid
from sqlalchemy import Date, DateTime, String, Numeric, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DriverStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    ON_TRIP = "ON_TRIP"
    OFF_DUTY = "OFF_DUTY"
    SUSPENDED = "SUSPENDED"


class Driver(Base):
    """Driver database model."""

    __tablename__ = "drivers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    license_number: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    license_category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    license_expiry_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    contact_number: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    safety_score: Mapped[float] = mapped_column(
        Numeric(5, 2),
        default=100.00,
        nullable=False,
    )
    status: Mapped[DriverStatus] = mapped_column(
        SQLEnum(DriverStatus, name="driver_status"),
        default=DriverStatus.AVAILABLE,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    trips: Mapped[List["Trip"]] = relationship(
        "Trip", back_populates="driver", cascade="all, delete-orphan"
    )
