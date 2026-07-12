from datetime import date
import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, role_required
from app.models.user import User, UserRole
from app.schemas.fuel_log import FuelLogCreate, FuelLogRead, FuelLogUpdate
from app.services import fuel_log_service

router = APIRouter()


@router.post("/", response_model=FuelLogRead, status_code=status.HTTP_201_CREATED)
async def create_new_fuel_log(
    log_in: FuelLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FINANCIAL_ANALYST)),
) -> Any:
    """Registers a new fuel log. Accessible to Financial Analysts and Admins."""
    return await fuel_log_service.create_fuel_log(db, obj_in=log_in, creator_id=current_user.id)


@router.get("/", response_model=List[FuelLogRead])
async def read_fuel_logs(
    vehicle_id: Optional[uuid.UUID] = Query(default=None),
    trip_id: Optional[uuid.UUID] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.FINANCIAL_ANALYST, UserRole.FLEET_MANAGER)
    ),
) -> Any:
    """Lists fuel logs with filtering and pagination. Accessible to Financial Analysts, Fleet Managers, and Admins."""
    return await fuel_log_service.list_fuel_logs(
        db,
        vehicle_id=vehicle_id,
        trip_id=trip_id,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )


@router.get("/{id}", response_model=FuelLogRead)
async def read_fuel_log(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.FINANCIAL_ANALYST, UserRole.FLEET_MANAGER)
    ),
) -> Any:
    """Retrieves details of a single fuel log by UUID. Accessible to Financial Analysts, Fleet Managers, and Admins."""
    log = await fuel_log_service.get_fuel_log_by_id(db, log_id=id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fuel log not found.",
        )
    return log


@router.patch("/{id}", response_model=FuelLogRead)
async def update_fuel_log_details(
    id: uuid.UUID,
    log_in: FuelLogUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FINANCIAL_ANALYST)),
) -> Any:
    """Updates details of an existing fuel log. Accessible to Financial Analysts and Admins."""
    log = await fuel_log_service.get_fuel_log_by_id(db, log_id=id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fuel log not found.",
        )
    return await fuel_log_service.update_fuel_log(db, db_obj=log, obj_in=log_in)


@router.delete("/{id}", response_model=FuelLogRead)
async def delete_fuel_log_record(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FINANCIAL_ANALYST)),
) -> Any:
    """Deletes an existing fuel log. Accessible to Financial Analysts and Admins."""
    log = await fuel_log_service.get_fuel_log_by_id(db, log_id=id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fuel log not found.",
        )
    return await fuel_log_service.delete_fuel_log(db, db_obj=log)
