import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, role_required
from app.models.user import User, UserRole
from app.models.driver import DriverStatus
from app.schemas.driver import DriverCreate, DriverRead, DriverUpdate
from app.services import driver_service

router = APIRouter()


@router.post("/", response_model=DriverRead, status_code=status.HTTP_201_CREATED)
async def create_new_driver(
    driver_in: DriverCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.SAFETY_OFFICER)),
) -> Any:
    """Registers a new driver. Accessible to Safety Officers and Admins."""
    existing = await driver_service.get_driver_by_license(db, license_number=driver_in.license_number)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A driver with this license number already exists.",
        )
    return await driver_service.create_driver(db, obj_in=driver_in)


@router.get("/", response_model=List[DriverRead])
async def read_drivers(
    status_filter: Optional[DriverStatus] = Query(default=None, alias="status"),
    license_category: Optional[str] = Query(default=None),
    expired: Optional[bool] = Query(default=None),
    search: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.SAFETY_OFFICER, UserRole.DISPATCHER)
    ),
) -> Any:
    """Lists drivers with filtering, search, and pagination. Accessible to Safety Officers, Dispatchers, and Admins."""
    return await driver_service.list_drivers(
        db,
        status_filter=status_filter,
        license_category=license_category,
        expired=expired,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get("/available", response_model=List[DriverRead])
async def read_available_drivers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.DISPATCHER)),
) -> Any:
    """Lists available drivers whose licenses are not expired. Accessible to Dispatchers and Admins."""
    return await driver_service.list_drivers(
        db,
        status_filter=DriverStatus.AVAILABLE,
        expired=False,
    )


@router.get("/{id}", response_model=DriverRead)
async def read_driver(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.SAFETY_OFFICER, UserRole.DISPATCHER)
    ),
) -> Any:
    """Retrieves a single driver by UUID. Accessible to Safety Officers, Dispatchers, and Admins."""
    driver = await driver_service.get_driver_by_id(db, driver_id=id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found.",
        )
    return driver


@router.patch("/{id}", response_model=DriverRead)
async def update_driver_profile(
    id: uuid.UUID,
    driver_in: DriverUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.SAFETY_OFFICER)),
) -> Any:
    """Updates driver profile. Accessible to Safety Officers and Admins."""
    driver = await driver_service.get_driver_by_id(db, driver_id=id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found.",
        )
    return await driver_service.update_driver(db, db_obj=driver, obj_in=driver_in)


@router.post("/{id}/suspend", response_model=DriverRead)
async def suspend_driver_record(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.SAFETY_OFFICER)),
) -> Any:
    """Suspends a driver. Accessible to Safety Officers and Admins."""
    driver = await driver_service.get_driver_by_id(db, driver_id=id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found.",
        )
    return await driver_service.suspend_driver(db, db_obj=driver)


@router.post("/{id}/activate", response_model=DriverRead)
async def activate_driver_record(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.SAFETY_OFFICER)),
) -> Any:
    """Activates a driver, returning status to AVAILABLE. Accessible to Safety Officers and Admins."""
    driver = await driver_service.get_driver_by_id(db, driver_id=id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found.",
        )
    return await driver_service.activate_driver(db, db_obj=driver)
