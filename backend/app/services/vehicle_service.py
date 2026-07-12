import uuid
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vehicle import Vehicle, VehicleStatus
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


async def get_vehicle_by_id(db: AsyncSession, vehicle_id: uuid.UUID) -> Optional[Vehicle]:
    """Retrieves a vehicle from the database by its unique UUID."""
    query = select(Vehicle).where(Vehicle.id == vehicle_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_vehicle_by_registration(db: AsyncSession, registration_number: str) -> Optional[Vehicle]:
    """Retrieves a vehicle from the database by its registration number."""
    query = select(Vehicle).where(Vehicle.registration_number == registration_number.strip())
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def list_vehicles(
    db: AsyncSession,
    *,
    status_filter: Optional[VehicleStatus] = None,
    vehicle_type: Optional[str] = None,
    region: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Vehicle]:
    """Lists vehicles with optional filters, search, and pagination."""
    query = select(Vehicle)

    if status_filter:
        query = query.where(Vehicle.status == status_filter)
    if vehicle_type:
        query = query.where(Vehicle.vehicle_type == vehicle_type.strip())
    if region:
        query = query.where(Vehicle.region == region.strip())
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Vehicle.registration_number.ilike(search_term),
                Vehicle.name.ilike(search_term),
                Vehicle.model.ilike(search_term),
            )
        )

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def create_vehicle(db: AsyncSession, obj_in: VehicleCreate) -> Vehicle:
    """Registers a new vehicle in the database, defaulting status to AVAILABLE."""
    db_vehicle = Vehicle(
        registration_number=obj_in.registration_number.strip(),
        name=obj_in.name.strip(),
        model=obj_in.model.strip() if obj_in.model else None,
        vehicle_type=obj_in.vehicle_type.strip(),
        max_load_capacity=obj_in.max_load_capacity,
        odometer=obj_in.odometer,
        acquisition_cost=obj_in.acquisition_cost,
        region=obj_in.region.strip() if obj_in.region else None,
        status=VehicleStatus.AVAILABLE,
    )
    try:
        db.add(db_vehicle)
        await db.commit()
        await db.refresh(db_vehicle)
        return db_vehicle
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A vehicle with this registration number already exists.",
        )
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during vehicle registration.",
        )


async def update_vehicle(
    db: AsyncSession, db_obj: Vehicle, obj_in: VehicleUpdate
) -> Vehicle:
    """Updates selected vehicle attributes."""
    update_data = obj_in.model_dump(exclude_unset=True)

    if "registration_number" in update_data:
        db_obj.registration_number = update_data["registration_number"].strip()
        del update_data["registration_number"]

    for field, value in update_data.items():
        if isinstance(value, str):
            setattr(db_obj, field, value.strip())
        else:
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
            detail="A vehicle with this registration number already exists.",
        )
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during vehicle update.",
        )


async def retire_vehicle(db: AsyncSession, db_obj: Vehicle) -> Vehicle:
    """Sets a vehicle status to RETIRED."""
    db_obj.status = VehicleStatus.RETIRED
    try:
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during vehicle retirement.",
        )
