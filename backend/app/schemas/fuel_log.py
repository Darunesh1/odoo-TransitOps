from datetime import date, datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class FuelLogBase(BaseModel):
    """Base fields shared across FuelLog schemas."""

    model_config = ConfigDict(from_attributes=True)

    vehicle_id: uuid.UUID
    trip_id: Optional[uuid.UUID] = None
    liters: float = Field(..., gt=0.0)
    cost: float = Field(..., ge=0.0)
    date: date
    odometer: Optional[float] = Field(default=None, ge=0.0)


class FuelLogCreate(FuelLogBase):
    """Schema for creating a new fuel log."""
    pass


class FuelLogUpdate(BaseModel):
    """Schema for updating a fuel log. All fields are optional."""

    vehicle_id: Optional[uuid.UUID] = None
    trip_id: Optional[uuid.UUID] = None
    liters: Optional[float] = Field(default=None, gt=0.0)
    cost: Optional[float] = Field(default=None, ge=0.0)
    date: Optional[date] = None
    odometer: Optional[float] = Field(default=None, ge=0.0)


class FuelLogRead(FuelLogBase):
    """Schema returned when reading a fuel log."""

    id: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
