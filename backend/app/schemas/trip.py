from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.trip import TripStatus


class TripBase(BaseModel):
    """Base fields shared across Trip schemas."""

    model_config = ConfigDict(from_attributes=True)

    source: str = Field(..., max_length=255)
    destination: str = Field(..., max_length=255)
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    cargo_weight: float = Field(..., gt=0.0)
    planned_distance: float = Field(..., gt=0.0)
    revenue: float = Field(default=0.00, ge=0.00)


class TripCreate(TripBase):
    """Schema for creating a new trip."""
    pass


class TripUpdate(BaseModel):
    """Schema for updating a draft trip. All fields are optional."""

    source: Optional[str] = Field(default=None, max_length=255)
    destination: Optional[str] = Field(default=None, max_length=255)
    vehicle_id: Optional[uuid.UUID] = None
    driver_id: Optional[uuid.UUID] = None
    cargo_weight: Optional[float] = Field(default=None, gt=0.0)
    planned_distance: Optional[float] = Field(default=None, gt=0.0)
    revenue: Optional[float] = Field(default=None, ge=0.0)


class TripCompleteInput(BaseModel):
    """Schema for completing a trip."""

    final_odometer: float = Field(..., ge=0.0)
    fuel_consumed: float = Field(..., ge=0.0)


class TripRead(TripBase):
    """Schema returned when reading a trip."""

    id: uuid.UUID
    trip_number: str
    status: TripStatus
    start_odometer: Optional[float] = None
    final_odometer: Optional[float] = None
    fuel_consumed: Optional[float] = None
    created_by: uuid.UUID
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
