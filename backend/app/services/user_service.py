from typing import Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import hash_password
from app.models.role import Role
from app.models.user import User, UserRole
from app.schemas.user import AdminUserUpdate, UserCreate, UserRolesAdd, UserUpdate


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Retrieves a user from the database by email address."""
    query = select(User).where(User.email == email.lower().strip())
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
    """Retrieves a user from the database by their unique UUID."""
    query = select(User).options(selectinload(User.roles)).where(User.id == user_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_users(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 100,
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
) -> list[User]:
    """List users with optional filters and pagination."""
    query = select(User).options(selectinload(User.roles))

    if role is not None:
        query = query.join(User.roles).where(Role.name == role.value)

    if is_active is not None:
        query = query.where(User.is_active == is_active)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            User.full_name.ilike(search_term) | User.email.ilike(search_term)
        )

    query = query.distinct().order_by(User.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    return list(result.scalars().unique().all())


async def admin_update_user(
    db: AsyncSession, db_obj: User, obj_in: AdminUserUpdate
) -> User:
    """Updates admin-managed account fields only."""
    update_data = obj_in.model_dump(exclude_unset=True)

    if "email" in update_data:
        db_obj.email = update_data["email"].lower().strip()

    if "full_name" in update_data:
        db_obj.full_name = update_data["full_name"]

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


async def set_user_active_status(
    db: AsyncSession, db_obj: User, is_active: bool
) -> User:
    """Sets a user's active status and persists the change."""
    db_obj.is_active = is_active
    try:
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while updating user status.",
        )


async def add_roles_to_user(
    db: AsyncSession, db_obj: User, obj_in: UserRolesAdd
) -> User:
    """Adds missing roles to a user and keeps superuser state in sync."""
    role_names = [role.value for role in obj_in.roles]
    role_query = select(Role).where(Role.name.in_(role_names))
    role_result = await db.execute(role_query)
    db_roles = role_result.scalars().all()

    if len(db_roles) != len(set(role_names)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more roles not found.",
        )

    existing_role_names = {role.name for role in db_obj.roles}
    for role in db_roles:
        if role.name not in existing_role_names:
            db_obj.roles.append(role)

    db_obj.is_superuser = any(role.name == "ADMIN" for role in db_obj.roles)

    try:
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while updating user roles.",
        )


async def remove_role_from_user(
    db: AsyncSession, db_obj: User, role_name: UserRole
) -> User:
    """Removes a role from a user while preserving account integrity."""
    role_to_remove = next((role for role in db_obj.roles if role.name == role_name.value), None)
    if not role_to_remove:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not assigned to user.",
        )

    if len(db_obj.roles) == 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user must keep at least one role.",
        )

    if role_name.value == "ADMIN" and db_obj.is_active:
        admin_count_query = (
            select(func.count(User.id))
            .join(User.roles)
            .where(Role.name == "ADMIN", User.is_active.is_(True))
        )
        admin_count_result = await db.execute(admin_count_query)
        active_admin_count = int(admin_count_result.scalar() or 0)
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one active ADMIN user must remain.",
            )

    db_obj.roles = [role for role in db_obj.roles if role.name != role_name.value]
    db_obj.is_superuser = any(role.name == "ADMIN" for role in db_obj.roles)

    try:
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while updating user roles.",
        )


async def create_user(db: AsyncSession, obj_in: UserCreate) -> User:
    """Hashes the password and creates a new User record in the database."""
    hashed_pwd = hash_password(obj_in.password)
    
    # Query database Role entities
    from app.models.role import Role
    role_names = [r.value for r in obj_in.roles]
    role_query = select(Role).where(Role.name.in_(role_names))
    role_result = await db.execute(role_query)
    db_roles = role_result.scalars().all()

    db_user = User(
        email=obj_in.email.lower().strip(),
        hashed_password=hashed_pwd,
        full_name=obj_in.full_name,
        roles=db_roles,
        is_active=True,
        is_superuser="ADMIN" in [r.name for r in db_roles],
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

    if "roles" in update_data and update_data["roles"] is not None:
        from app.models.role import Role
        role_names = [r.value for r in update_data["roles"]]
        role_query = select(Role).where(Role.name.in_(role_names))
        role_result = await db.execute(role_query)
        db_roles = role_result.scalars().all()
        db_obj.roles = db_roles
        db_obj.is_superuser = "ADMIN" in [r.name for r in db_roles]
        del update_data["roles"]

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
