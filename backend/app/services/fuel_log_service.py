from datetime import date
import uuid
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fuel_log import FuelLog
from app.models.vehicle import Vehicle
from app.models.trip import Trip
from app.schemas.fuel_log import FuelLogCreate, FuelLogUpdate


async def get_fuel_log_by_id(db: AsyncSession, log_id: uuid.UUID) -> Optional[FuelLog]:
    """Retrieves a fuel log from the database by UUID."""
    query = select(FuelLog).where(FuelLog.id == log_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def list_fuel_logs(
    db: AsyncSession,
    *,
    vehicle_id: Optional[uuid.UUID] = None,
    trip_id: Optional[uuid.UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[FuelLog]:
    """Lists fuel logs with optional filters and pagination."""
    query = select(FuelLog)

    if vehicle_id:
        query = query.where(FuelLog.vehicle_id == vehicle_id)
    if trip_id:
        query = query.where(FuelLog.trip_id == trip_id)
    if date_from:
        query = query.where(FuelLog.date >= date_from)
    if date_to:
        query = query.where(FuelLog.date <= date_to)

    query = query.order_by(FuelLog.date.desc(), FuelLog.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def validate_vehicle_and_trip(
    db: AsyncSession, vehicle_id: uuid.UUID, trip_id: Optional[uuid.UUID]
) -> None:
    """Helper to validate that the vehicle exists and that the optional trip belongs to it."""
    # 1. Validate Vehicle
    v_query = select(Vehicle).where(Vehicle.id == vehicle_id)
    v_res = await db.execute(v_query)
    vehicle = v_res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found.",
        )

    # 2. Validate Trip if present
    if trip_id:
        t_query = select(Trip).where(Trip.id == trip_id)
        t_res = await db.execute(t_query)
        trip = t_res.scalar_one_or_none()
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip not found.",
            )
        if trip.vehicle_id != vehicle_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The provided trip does not belong to the selected vehicle.",
            )


async def create_fuel_log(db: AsyncSession, obj_in: FuelLogCreate, creator_id: uuid.UUID) -> FuelLog:
    """Creates a new fuel log after verifying vehicle/trip relations."""
    await validate_vehicle_and_trip(db, obj_in.vehicle_id, obj_in.trip_id)

    db_log = FuelLog(
        vehicle_id=obj_in.vehicle_id,
        trip_id=obj_in.trip_id,
        liters=obj_in.liters,
        cost=obj_in.cost,
        date=obj_in.date,
        odometer=obj_in.odometer,
        created_by=creator_id,
    )
    try:
        db.add(db_log)
        await db.commit()
        await db.refresh(db_log)
        return db_log
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during fuel log creation.",
        )


async def update_fuel_log(
    db: AsyncSession, db_obj: FuelLog, obj_in: FuelLogUpdate
) -> FuelLog:
    """Updates attributes of a fuel log, checking relations if IDs are updated."""
    # Determine resolved vehicle and trip IDs
    v_id = obj_in.vehicle_id if obj_in.vehicle_id is not None else db_obj.vehicle_id
    t_id = obj_in.trip_id if obj_in.trip_id is not None else db_obj.trip_id

    # If either vehicle_id or trip_id is updated, validate again
    if obj_in.vehicle_id is not None or obj_in.trip_id is not None:
        await validate_vehicle_and_trip(db, v_id, t_id)

    update_data = obj_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)

    try:
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during fuel log update.",
        )


async def delete_fuel_log(db: AsyncSession, db_obj: FuelLog) -> FuelLog:
    """Deletes a fuel log from the database."""
    try:
        await db.delete(db_obj)
        await db.commit()
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during fuel log deletion.",
        )
