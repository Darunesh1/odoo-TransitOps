from datetime import date, datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.driver import DriverStatus


class DriverBase(BaseModel):
    """Base fields shared across Driver schemas."""

    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., max_length=255)
    license_number: str = Field(..., max_length=100)
    license_category: str = Field(..., max_length=50)
    license_expiry_date: date
    contact_number: Optional[str] = Field(default=None, max_length=50)
    safety_score: float = Field(default=100.0, ge=0.0, le=100.0)
    status: DriverStatus = DriverStatus.AVAILABLE


class DriverCreate(BaseModel):
    """Schema for registering a new driver. Status defaults to AVAILABLE."""

    name: str = Field(..., max_length=255)
    license_number: str = Field(..., max_length=100)
    license_category: str = Field(..., max_length=50)
    license_expiry_date: date
    contact_number: Optional[str] = Field(default=None, max_length=50)
    safety_score: float = Field(default=100.0, ge=0.0, le=100.0)


class DriverUpdate(BaseModel):
    """Schema for updating a driver profile. All fields are optional."""

    name: Optional[str] = Field(default=None, max_length=255)
    license_number: Optional[str] = Field(default=None, max_length=100)
    license_category: Optional[str] = Field(default=None, max_length=50)
    license_expiry_date: Optional[date] = None
    contact_number: Optional[str] = Field(default=None, max_length=50)
    safety_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    status: Optional[DriverStatus] = None


class DriverRead(DriverBase):
    """Schema returned when reading a driver."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
