from datetime import date, datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class ExpenseBase(BaseModel):
    """Base fields shared across Expense schemas."""

    model_config = ConfigDict(from_attributes=True)

    vehicle_id: uuid.UUID
    trip_id: Optional[uuid.UUID] = None
    expense_type: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    amount: float = Field(..., ge=0.0)
    date: date


class ExpenseCreate(ExpenseBase):
    """Schema for creating a new expense."""
    pass


class ExpenseUpdate(BaseModel):
    """Schema for updating an expense. All fields are optional."""

    vehicle_id: Optional[uuid.UUID] = None
    trip_id: Optional[uuid.UUID] = None
    expense_type: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    amount: Optional[float] = Field(default=None, ge=0.0)
    date: Optional[date] = None


class ExpenseRead(ExpenseBase):
    """Schema returned when reading an expense."""

    id: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
