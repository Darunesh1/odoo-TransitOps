from datetime import datetime, timezone
import enum
from typing import Optional, List
import uuid
from sqlalchemy import DateTime, String, Numeric, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class VehicleStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    ON_TRIP = "ON_TRIP"
    IN_SHOP = "IN_SHOP"
    RETIRED = "RETIRED"


class Vehicle(Base):
    """Vehicle database model."""

    __tablename__ = "vehicles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    registration_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    model: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    vehicle_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    max_load_capacity: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    odometer: Mapped[float] = mapped_column(
        Numeric(10, 2),
        default=0.0,
        nullable=False,
    )
    acquisition_cost: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )
    region: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    status: Mapped[VehicleStatus] = mapped_column(
        SQLEnum(VehicleStatus, name="vehicle_status"),
        default=VehicleStatus.AVAILABLE,
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
        "Trip", back_populates="vehicle", cascade="all, delete-orphan"
    )
    maintenance_logs: Mapped[List["MaintenanceLog"]] = relationship(
        "MaintenanceLog", back_populates="vehicle", cascade="all, delete-orphan"
    )
    fuel_logs: Mapped[List["FuelLog"]] = relationship(
        "FuelLog", back_populates="vehicle", cascade="all, delete-orphan"
    )
    expenses: Mapped[List["Expense"]] = relationship(
        "Expense", back_populates="vehicle", cascade="all, delete-orphan"
    )
