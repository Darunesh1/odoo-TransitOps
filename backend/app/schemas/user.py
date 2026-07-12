from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class UserBase(BaseModel):
    """Base fields shared across User schemas."""

    model_config = ConfigDict(from_attributes=True)

    email: EmailStr
    full_name: str = Field(..., max_length=255)
    role: UserRole
    is_active: bool = True
    is_superuser: bool = False
    is_verified: bool = True


class UserCreate(BaseModel):
    """Schema for user creation by superuser."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(..., max_length=255)
    role: UserRole



class UserUpdate(BaseModel):
    """Schema for updating user details. All fields are optional."""

    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    is_verified: Optional[bool] = None


class UserRead(UserBase):
    """Schema returned when reading user details from the database."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

