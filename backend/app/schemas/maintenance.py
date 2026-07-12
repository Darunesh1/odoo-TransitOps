from datetime import datetime, timezone
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.maintenance_log import MaintenanceStatus


class MaintenanceBase(BaseModel):
    """Base fields shared across Maintenance schemas."""

    model_config = ConfigDict(from_attributes=True)

    vehicle_id: uuid.UUID
    maintenance_type: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    cost: float = Field(default=0.00, ge=0.00)
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MaintenanceCreate(MaintenanceBase):
    """Schema for creating a new maintenance log."""
    pass


class MaintenanceUpdate(BaseModel):
    """Schema for updating an active maintenance log. All fields are optional."""

    maintenance_type: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    cost: Optional[float] = Field(default=None, ge=0.00)
    started_at: Optional[datetime] = None


class MaintenanceRead(MaintenanceBase):
    """Schema returned when reading a maintenance log."""

    id: uuid.UUID
    status: MaintenanceStatus
    completed_at: Optional[datetime] = None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
