from typing import Optional
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User
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
        is_active=True,
        is_superuser=False,
        is_verified=False,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user


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

    for field, value in update_data.items():
        setattr(db_obj, field, value)

    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def verify_user_email(db: AsyncSession, db_obj: User) -> User:
    """Marks a user as verified in the database."""
    db_obj.is_verified = True
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj
