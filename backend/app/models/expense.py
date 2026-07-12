from datetime import date, datetime, timezone
import uuid
from typing import Optional
from sqlalchemy import Date, DateTime, ForeignKey, String, Text, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Expense(Base):
    """Expense database model."""

    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.id", ondelete="CASCADE"),
        nullable=False,
    )
    trip_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trips.id", ondelete="SET NULL"),
        nullable=True,
    )
    expense_type: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    amount: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
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
    vehicle: Mapped["Vehicle"] = relationship("Vehicle", back_populates="expenses")
    trip: Mapped[Optional["Trip"]] = relationship("Trip", back_populates="expenses")
    creator: Mapped["User"] = relationship("User", back_populates="expenses")
