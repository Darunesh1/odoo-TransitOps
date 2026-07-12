import uuid
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_superuser, get_current_user, get_db, role_required
from app.models.user import User, UserRole
from app.schemas.user import AdminUserUpdate, UserCreate, UserRead, UserRolesAdd, UserUpdate
from app.services import (
    admin_update_user,
    add_roles_to_user,
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_users,
    remove_role_from_user,
    set_user_active_status,
    update_user,
)

router = APIRouter()



@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_new_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
) -> Any:
    """Creates a new user. Accessible only to superusers."""
    user = await get_user_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists in the system.",
        )
    new_user = await create_user(db, obj_in=user_in)
    return new_user


@router.get("", response_model=list[UserRead])
@router.get("/", response_model=list[UserRead])
async def read_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1),
    role: Optional[UserRole] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    search: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
) -> Any:
    """Lists users with filtering and pagination. Accessible only to superusers."""
    return await get_users(
        db,
        skip=skip,
        limit=limit,
        role=role,
        is_active=is_active,
        search=search,
    )


@router.get("/me", response_model=UserRead)
async def read_user_me(current_user: User = Depends(get_current_user)) -> Any:
    """Retrieves profile details of the currently authenticated user."""
    return current_user


@router.put("/me", response_model=UserRead)
async def update_user_me(
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Updates profile details for the currently authenticated user."""
    if user_in.email:
        existing_user = await get_user_by_email(db, email=user_in.email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists.",
            )

    updated = await update_user(db, db_obj=current_user, obj_in=user_in)
    return updated


@router.get("/test-fleet-manager", response_model=UserRead)
async def test_fleet_manager_route(
    current_user: User = Depends(role_required(UserRole.FLEET_MANAGER)),
) -> Any:
    """Testing endpoint requiring FLEET_MANAGER role."""
    return current_user


@router.get("/test-safety-officer", response_model=UserRead)
async def test_safety_officer_route(
    current_user: User = Depends(role_required(UserRole.SAFETY_OFFICER)),
) -> Any:
    """Testing endpoint requiring SAFETY_OFFICER role."""
    return current_user


@router.post("/{user_id}/roles", response_model=UserRead)
async def add_roles_to_user_by_id(
    user_id: uuid.UUID,
    user_in: UserRolesAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
) -> Any:
    """Adds roles to a user. Accessible only to superusers."""
    user = await get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return await add_roles_to_user(db, db_obj=user, obj_in=user_in)


@router.delete("/{user_id}/roles/{role_name}", response_model=UserRead)
async def remove_role_from_user_by_id(
    user_id: uuid.UUID,
    role_name: UserRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
) -> Any:
    """Removes a role from a user. Accessible only to superusers."""
    user = await get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return await remove_role_from_user(db, db_obj=user, role_name=role_name)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user_by_id(
    user_id: uuid.UUID,
    user_in: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
) -> Any:
    """Updates common account fields for a user. Accessible only to superusers."""
    user = await get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user_in.email:
        existing_user = await get_user_by_email(db, email=user_in.email)
        if existing_user and existing_user.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists.",
            )

    return await admin_update_user(db, db_obj=user, obj_in=user_in)


@router.post("/{user_id}/deactivate", response_model=UserRead)
async def deactivate_user_by_id(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
) -> Any:
    """Deactivates a user account. Accessible only to superusers."""
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account.",
        )

    user = await get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return await set_user_active_status(db, db_obj=user, is_active=False)


@router.post("/{user_id}/activate", response_model=UserRead)
async def activate_user_by_id(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
) -> Any:
    """Reactivates a user account. Accessible only to superusers."""
    user = await get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return await set_user_active_status(db, db_obj=user, is_active=True)


@router.get("/{user_id}", response_model=UserRead)
async def read_user_by_id(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
) -> Any:
    """Retrieves a user by UUID. Accessible only to superusers."""
    user = await get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user
