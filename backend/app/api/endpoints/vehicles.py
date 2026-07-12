import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, role_required
from app.models.user import User, UserRole
from app.models.vehicle import VehicleStatus
from app.schemas.vehicle import VehicleCreate, VehicleRead, VehicleUpdate
from app.services import vehicle_service

router = APIRouter()


@router.post("/", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
async def create_new_vehicle(
    vehicle_in: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FLEET_MANAGER)),
) -> Any:
    """Registers a new vehicle. Accessible to Fleet Managers and Admins."""
    existing = await vehicle_service.get_vehicle_by_registration(db, registration_number=vehicle_in.registration_number)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A vehicle with this registration number already exists.",
        )
    return await vehicle_service.create_vehicle(db, obj_in=vehicle_in)


@router.get("/", response_model=List[VehicleRead])
async def read_vehicles(
    status_filter: Optional[VehicleStatus] = Query(default=None, alias="status"),
    vehicle_type: Optional[str] = Query(default=None),
    region: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.FLEET_MANAGER, UserRole.DISPATCHER, UserRole.FINANCIAL_ANALYST)
    ),
) -> Any:
    """Lists vehicles with filtering and search support. Accessible to Fleet Managers, Dispatchers, Financial Analysts, and Admins."""
    return await vehicle_service.list_vehicles(
        db,
        status_filter=status_filter,
        vehicle_type=vehicle_type,
        region=region,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get("/available", response_model=List[VehicleRead])
async def read_available_vehicles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.DISPATCHER)),
) -> Any:
    """Lists only available vehicles. Accessible to Dispatchers and Admins."""
    return await vehicle_service.list_vehicles(
        db,
        status_filter=VehicleStatus.AVAILABLE,
    )


@router.get("/{id}", response_model=VehicleRead)
async def read_vehicle(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.FLEET_MANAGER, UserRole.DISPATCHER, UserRole.FINANCIAL_ANALYST)
    ),
) -> Any:
    """Retrieves a single vehicle by UUID. Accessible to Fleet Managers, Dispatchers, Financial Analysts, and Admins."""
    vehicle = await vehicle_service.get_vehicle_by_id(db, vehicle_id=id)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found.",
        )
    return vehicle


@router.patch("/{id}", response_model=VehicleRead)
async def update_vehicle_details(
    id: uuid.UUID,
    vehicle_in: VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FLEET_MANAGER)),
) -> Any:
    """Updates vehicle details. Accessible to Fleet Managers and Admins."""
    vehicle = await vehicle_service.get_vehicle_by_id(db, vehicle_id=id)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found.",
        )
    return await vehicle_service.update_vehicle(db, db_obj=vehicle, obj_in=vehicle_in)


@router.post("/{id}/retire", response_model=VehicleRead)
async def retire_vehicle_record(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FLEET_MANAGER)),
) -> Any:
    """Retires a vehicle by setting its status to RETIRED. Accessible to Fleet Managers and Admins."""
    vehicle = await vehicle_service.get_vehicle_by_id(db, vehicle_id=id)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found.",
        )
    return await vehicle_service.retire_vehicle(db, db_obj=vehicle)
