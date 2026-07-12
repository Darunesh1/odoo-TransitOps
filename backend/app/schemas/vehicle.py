from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.vehicle import VehicleStatus


class VehicleBase(BaseModel):
    """Base fields shared across Vehicle schemas."""

    model_config = ConfigDict(from_attributes=True)

    registration_number: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    model: Optional[str] = Field(default=None, max_length=255)
    vehicle_type: str = Field(..., max_length=100)
    max_load_capacity: float = Field(..., gt=0.0)
    odometer: float = Field(default=0.0, ge=0.0)
    acquisition_cost: float = Field(..., ge=0.0)
    region: Optional[str] = Field(default=None, max_length=100)
    status: VehicleStatus = VehicleStatus.AVAILABLE


class VehicleCreate(BaseModel):
    """Schema for creating a vehicle. Status defaults to AVAILABLE."""

    registration_number: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    model: Optional[str] = Field(default=None, max_length=255)
    vehicle_type: str = Field(..., max_length=100)
    max_load_capacity: float = Field(..., gt=0.0)
    odometer: float = Field(default=0.0, ge=0.0)
    acquisition_cost: float = Field(..., ge=0.0)
    region: Optional[str] = Field(default=None, max_length=100)


class VehicleUpdate(BaseModel):
    """Schema for updating a vehicle. All fields are optional."""

    registration_number: Optional[str] = Field(default=None, max_length=50)
    name: Optional[str] = Field(default=None, max_length=255)
    model: Optional[str] = Field(default=None, max_length=255)
    vehicle_type: Optional[str] = Field(default=None, max_length=100)
    max_load_capacity: Optional[float] = Field(default=None, gt=0.0)
    odometer: Optional[float] = Field(default=None, ge=0.0)
    acquisition_cost: Optional[float] = Field(default=None, ge=0.0)
    region: Optional[str] = Field(default=None, max_length=100)
    status: Optional[VehicleStatus] = None


class VehicleRead(VehicleBase):
    """Schema returned when reading a vehicle."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
