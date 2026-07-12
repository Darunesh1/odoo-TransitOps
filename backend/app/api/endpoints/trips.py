import uuid
from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, role_required
from app.models.user import User, UserRole
from app.models.trip import TripStatus
from app.schemas.trip import TripCreate, TripRead, TripUpdate, TripCompleteInput
from app.services import trip_service

router = APIRouter()


@router.post("/", response_model=TripRead, status_code=status.HTTP_201_CREATED)
async def create_new_trip(
    trip_in: TripCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.DISPATCHER)),
) -> Any:
    """Creates a new trip in DRAFT status. Accessible to Dispatchers and Admins."""
    return await trip_service.create_trip(db, obj_in=trip_in, creator_id=current_user.id)


@router.get("/", response_model=List[TripRead])
async def read_trips(
    status_filter: Optional[TripStatus] = Query(default=None, alias="status"),
    vehicle_id: Optional[uuid.UUID] = Query(default=None),
    driver_id: Optional[uuid.UUID] = Query(default=None),
    start_date: Optional[datetime] = Query(default=None),
    end_date: Optional[datetime] = Query(default=None),
    search: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.DISPATCHER, UserRole.FLEET_MANAGER, UserRole.SAFETY_OFFICER, UserRole.FINANCIAL_ANALYST)
    ),
) -> Any:
    """Lists trips with filtering, search, and pagination. Accessible to Dispatchers, Fleet Managers, Safety Officers, Financial Analysts, and Admins."""
    return await trip_service.list_trips(
        db,
        status_filter=status_filter,
        vehicle_id=vehicle_id,
        driver_id=driver_id,
        start_date=start_date,
        end_date=end_date,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get("/{id}", response_model=TripRead)
async def read_trip(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.DISPATCHER, UserRole.FLEET_MANAGER, UserRole.SAFETY_OFFICER, UserRole.FINANCIAL_ANALYST)
    ),
) -> Any:
    """Retrieves details of a single trip by UUID. Accessible to Dispatchers, Fleet Managers, Safety Officers, Financial Analysts, and Admins."""
    trip = await trip_service.get_trip_by_id(db, trip_id=id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found.",
        )
    return trip


@router.patch("/{id}", response_model=TripRead)
async def update_trip_details(
    id: uuid.UUID,
    trip_in: TripUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.DISPATCHER)),
) -> Any:
    """Updates details of a DRAFT trip. Accessible to Dispatchers and Admins."""
    trip = await trip_service.get_trip_by_id(db, trip_id=id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found.",
        )
    return await trip_service.update_trip(db, db_obj=trip, obj_in=trip_in)


@router.post("/{id}/dispatch", response_model=TripRead)
async def dispatch_trip_record(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.DISPATCHER)),
) -> Any:
    """Dispatches a DRAFT trip, assigning resources and setting status to DISPATCHED. Accessible to Dispatchers and Admins."""
    trip = await trip_service.get_trip_by_id(db, trip_id=id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found.",
        )
    return await trip_service.dispatch_trip(db, db_obj=trip)


@router.post("/{id}/complete", response_model=TripRead)
async def complete_trip_record(
    id: uuid.UUID,
    complete_in: TripCompleteInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.DISPATCHER)),
) -> Any:
    """Completes a DISPATCHED trip, logging fuel consumption and return resources to AVAILABLE. Accessible to Dispatchers and Admins."""
    trip = await trip_service.get_trip_by_id(db, trip_id=id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found.",
        )
    return await trip_service.complete_trip(db, db_obj=trip, complete_data=complete_in)


@router.post("/{id}/cancel", response_model=TripRead)
async def cancel_trip_record(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.DISPATCHER)),
) -> Any:
    """Cancels a trip. Restores resources to AVAILABLE if dispatched. Accessible to Dispatchers and Admins."""
    trip = await trip_service.get_trip_by_id(db, trip_id=id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found.",
        )
    return await trip_service.cancel_trip(db, db_obj=trip)
