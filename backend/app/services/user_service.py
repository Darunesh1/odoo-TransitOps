from typing import Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Retrieves a user from the database by email address."""
    query = select(User).where(User.email == email.lower().strip())
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
    """Retrieves a user from the database by their unique UUID."""
    query = select(User).where(User.id == user_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, obj_in: UserCreate) -> User:
    """Hashes the password and creates a new User record in the database."""
    hashed_pwd = hash_password(obj_in.password)
    db_user = User(
        email=obj_in.email.lower().strip(),
        hashed_password=hashed_pwd,
        full_name=obj_in.full_name,
        role=obj_in.role,
        is_active=True,
        is_superuser=(obj_in.role == UserRole.ADMIN),
        is_verified=True,
    )
    try:
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)
        return db_user
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during user creation.",
        )


async def update_user(
    db: AsyncSession, db_obj: User, obj_in: UserUpdate
) -> User:
    """Updates selected user record attributes, hashing the password if updated."""
    update_data = obj_in.model_dump(exclude_unset=True)

    if "password" in update_data and update_data["password"]:
        hashed_pwd = hash_password(update_data["password"])
        db_obj.hashed_password = hashed_pwd
        del update_data["password"]

    if "email" in update_data:
        db_obj.email = update_data["email"].lower().strip()
        del update_data["email"]

    if "role" in update_data and update_data["role"]:
        db_obj.role = update_data["role"]
        db_obj.is_superuser = (update_data["role"] == UserRole.ADMIN)
        del update_data["role"]

    for field, value in update_data.items():
        setattr(db_obj, field, value)

    try:
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during user update.",
        )

