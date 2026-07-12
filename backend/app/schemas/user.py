from datetime import datetime
from typing import Optional, List
import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserRole


class UserBase(BaseModel):
    """Base fields shared across User schemas."""

    model_config = ConfigDict(from_attributes=True)

    email: EmailStr
    full_name: str = Field(..., max_length=255)
    roles: List[UserRole]
    is_active: bool = True
    is_superuser: bool = False
    is_verified: bool = True

    @field_validator("roles", mode="before")
    @classmethod
    def convert_roles(cls, v):
        if isinstance(v, list):
            result = []
            for item in v:
                if hasattr(item, "name"):
                    result.append(item.name)
                else:
                    result.append(item)
            return list(set(result))
        return v


class UserCreate(BaseModel):
    """Schema for user creation by superuser."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(..., max_length=255)
    roles: List[UserRole] = Field(..., min_length=1)

    @field_validator("roles", mode="after")
    @classmethod
    def deduplicate_roles(cls, v):
        return list(set(v))


class UserUpdate(BaseModel):
    """Schema for updating user details. All fields are optional."""

    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    full_name: Optional[str] = None
    roles: Optional[List[UserRole]] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    is_verified: Optional[bool] = None

    @field_validator("roles", mode="after")
    @classmethod
    def deduplicate_roles(cls, v):
        if v is not None:
            return list(set(v))
        return v


class UserRead(UserBase):
    """Schema returned when reading user details from the database."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


