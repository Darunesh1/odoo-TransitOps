import uuid
from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, role_required
from app.models.user import User, UserRole
from app.models.maintenance_log import MaintenanceStatus
from app.schemas.maintenance import MaintenanceCreate, MaintenanceRead, MaintenanceUpdate
from app.services import maintenance_service

router = APIRouter()


@router.post("/", response_model=MaintenanceRead, status_code=status.HTTP_201_CREATED)
async def create_new_maintenance(
    log_in: MaintenanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FLEET_MANAGER)),
) -> Any:
    """Registers a new active maintenance log for a vehicle. Accessible to Fleet Managers and Admins."""
    return await maintenance_service.create_maintenance_log(db, obj_in=log_in, creator_id=current_user.id)


@router.get("/", response_model=List[MaintenanceRead])
async def read_maintenance_logs(
    vehicle_id: Optional[uuid.UUID] = Query(default=None),
    status_filter: Optional[MaintenanceStatus] = Query(default=None, alias="status"),
    maintenance_type: Optional[str] = Query(default=None),
    start_date: Optional[datetime] = Query(default=None),
    end_date: Optional[datetime] = Query(default=None),
    search: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.FLEET_MANAGER, UserRole.FINANCIAL_ANALYST)
    ),
) -> Any:
    """Lists maintenance logs with filtering, search, and pagination. Accessible to Fleet Managers, Financial Analysts, and Admins."""
    return await maintenance_service.list_maintenance_logs(
        db,
        vehicle_id=vehicle_id,
        status_filter=status_filter,
        maintenance_type=maintenance_type,
        start_date=start_date,
        end_date=end_date,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get("/{id}", response_model=MaintenanceRead)
async def read_maintenance_log(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.FLEET_MANAGER, UserRole.FINANCIAL_ANALYST)
    ),
) -> Any:
    """Retrieves details of a single maintenance log. Accessible to Fleet Managers, Financial Analysts, and Admins."""
    log = await maintenance_service.get_maintenance_by_id(db, log_id=id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Maintenance log not found.",
        )
    return log


@router.patch("/{id}", response_model=MaintenanceRead)
async def update_maintenance_details(
    id: uuid.UUID,
    log_in: MaintenanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FLEET_MANAGER)),
) -> Any:
    """Updates details of an active maintenance log. Accessible to Fleet Managers and Admins."""
    log = await maintenance_service.get_maintenance_by_id(db, log_id=id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Maintenance log not found.",
        )
    return await maintenance_service.update_maintenance_log(db, db_obj=log, obj_in=log_in)


@router.post("/{id}/complete", response_model=MaintenanceRead)
async def complete_maintenance(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FLEET_MANAGER)),
) -> Any:
    """Completes an active maintenance log, releasing the vehicle back to AVAILABLE. Accessible to Fleet Managers and Admins."""
    log = await maintenance_service.get_maintenance_by_id(db, log_id=id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Maintenance log not found.",
        )
    return await maintenance_service.complete_maintenance_log(db, db_obj=log)


@router.post("/{id}/cancel", response_model=MaintenanceRead)
async def cancel_maintenance(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FLEET_MANAGER)),
) -> Any:
    """Cancels an active maintenance log, releasing the vehicle back to AVAILABLE. Accessible to Fleet Managers and Admins."""
    log = await maintenance_service.get_maintenance_by_id(db, log_id=id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Maintenance log not found.",
        )
    return await maintenance_service.cancel_maintenance_log(db, db_obj=log)
