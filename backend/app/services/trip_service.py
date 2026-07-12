from datetime import date, datetime, timezone
import uuid
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy import select, or_, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip, TripStatus
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.driver import Driver, DriverStatus
from app.schemas.trip import TripCreate, TripUpdate, TripCompleteInput


async def get_trip_by_id(db: AsyncSession, trip_id: uuid.UUID) -> Optional[Trip]:
    """Retrieves a trip from the database by UUID."""
    query = select(Trip).where(Trip.id == trip_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def list_trips(
    db: AsyncSession,
    *,
    status_filter: Optional[TripStatus] = None,
    vehicle_id: Optional[uuid.UUID] = None,
    driver_id: Optional[uuid.UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Trip]:
    """Lists trips with optional filters (status, vehicle, driver, date range), search, and pagination."""
    query = select(Trip)

    if status_filter:
        query = query.where(Trip.status == status_filter)
    if vehicle_id:
        query = query.where(Trip.vehicle_id == vehicle_id)
    if driver_id:
        query = query.where(Trip.driver_id == driver_id)
    if start_date:
        query = query.where(Trip.created_at >= start_date)
    if end_date:
        query = query.where(Trip.created_at <= end_date)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Trip.trip_number.ilike(search_term),
                Trip.source.ilike(search_term),
                Trip.destination.ilike(search_term),
            )
        )

    query = query.order_by(Trip.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def create_trip(db: AsyncSession, obj_in: TripCreate, creator_id: uuid.UUID) -> Trip:
    """Creates a new trip in DRAFT status. Generates a sequential trip number."""
    # Obtain sequential trip number
    count_query = select(func.count(Trip.id))
    count_result = await db.execute(count_query)
    current_count = count_result.scalar() or 0
    trip_number = f"TRIP-{current_count + 1:06d}"

    db_trip = Trip(
        trip_number=trip_number,
        source=obj_in.source.strip(),
        destination=obj_in.destination.strip(),
        vehicle_id=obj_in.vehicle_id,
        driver_id=obj_in.driver_id,
        cargo_weight=obj_in.cargo_weight,
        planned_distance=obj_in.planned_distance,
        revenue=obj_in.revenue,
        status=TripStatus.DRAFT,
        created_by=creator_id,
    )
    try:
        db.add(db_trip)
        await db.commit()
        await db.refresh(db_trip)
        return db_trip
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during trip creation.",
        )


async def update_trip(
    db: AsyncSession, db_obj: Trip, obj_in: TripUpdate
) -> Trip:
    """Updates selected attributes of a trip. Allowed only when trip is in DRAFT status."""
    if db_obj.status != TripStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only DRAFT trips can be updated.",
        )

    update_data = obj_in.model_dump(exclude_unset=True)
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
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during trip update.",
        )


async def dispatch_trip(db: AsyncSession, db_obj: Trip) -> Trip:
    """Dispatches a trip. Enforces vehicle/driver availability and sets both to ON_TRIP status."""
    if db_obj.status != TripStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only DRAFT trips can be dispatched.",
        )

    # 1. Fetch and Lock Vehicle
    vehicle_query = select(Vehicle).where(Vehicle.id == db_obj.vehicle_id).with_for_update()
    vehicle_result = await db.execute(vehicle_query)
    vehicle = vehicle_result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle assigned to this trip does not exist.",
        )
    if vehicle.status != VehicleStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Assigned vehicle is not available (Current status: {vehicle.status.value}).",
        )

    # 2. Fetch and Lock Driver
    driver_query = select(Driver).where(Driver.id == db_obj.driver_id).with_for_update()
    driver_result = await db.execute(driver_query)
    driver = driver_result.scalar_one_or_none()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver assigned to this trip does not exist.",
        )
    if driver.status != DriverStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Assigned driver is not available (Current status: {driver.status.value}).",
        )
    if driver.license_expiry_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned driver cannot be dispatched because their license is expired.",
        )

    # 3. Check Capacity
    if db_obj.cargo_weight > vehicle.max_load_capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cargo weight ({db_obj.cargo_weight} kg) exceeds vehicle maximum capacity ({vehicle.max_load_capacity} kg).",
        )

    # 4. Transition Statuses
    db_obj.status = TripStatus.DISPATCHED
    db_obj.start_odometer = vehicle.odometer
    db_obj.dispatched_at = datetime.now(timezone.utc)

    vehicle.status = VehicleStatus.ON_TRIP
    driver.status = DriverStatus.ON_TRIP

    try:
        db.add(db_obj)
        db.add(vehicle)
        db.add(driver)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during trip dispatch.",
        )


async def complete_trip(db: AsyncSession, db_obj: Trip, complete_data: TripCompleteInput) -> Trip:
    """Completes a dispatched trip, updating final odometers and returning resources to AVAILABLE."""
    if db_obj.status != TripStatus.DISPATCHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only DISPATCHED trips can be completed.",
        )

    # Fetch and Lock Vehicle & Driver
    vehicle_query = select(Vehicle).where(Vehicle.id == db_obj.vehicle_id).with_for_update()
    vehicle_res = await db.execute(vehicle_query)
    vehicle = vehicle_res.scalar_one()

    driver_query = select(Driver).where(Driver.id == db_obj.driver_id).with_for_update()
    driver_res = await db.execute(driver_query)
    driver = driver_res.scalar_one()

    if complete_data.final_odometer < vehicle.odometer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Final odometer ({complete_data.final_odometer}) cannot be less than vehicle start odometer ({vehicle.odometer}).",
        )

    # Transition Statuses
    db_obj.status = TripStatus.COMPLETED
    db_obj.final_odometer = complete_data.final_odometer
    db_obj.fuel_consumed = complete_data.fuel_consumed
    db_obj.completed_at = datetime.now(timezone.utc)

    vehicle.odometer = complete_data.final_odometer
    vehicle.status = VehicleStatus.AVAILABLE
    driver.status = DriverStatus.AVAILABLE

    try:
        db.add(db_obj)
        db.add(vehicle)
        db.add(driver)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during trip completion.",
        )


async def cancel_trip(db: AsyncSession, db_obj: Trip) -> Trip:
    """Cancels a trip. Restores resources to AVAILABLE if the trip was already dispatched."""
    if db_obj.status in (TripStatus.COMPLETED, TripStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a trip that is already {db_obj.status.value}.",
        )

    was_dispatched = (db_obj.status == TripStatus.DISPATCHED)

    # Transition Status
    db_obj.status = TripStatus.CANCELLED
    db_obj.cancelled_at = datetime.now(timezone.utc)

    if was_dispatched:
        # Fetch and Lock Vehicle & Driver
        vehicle_query = select(Vehicle).where(Vehicle.id == db_obj.vehicle_id).with_for_update()
        vehicle_res = await db.execute(vehicle_query)
        vehicle = vehicle_res.scalar_one()

        driver_query = select(Driver).where(Driver.id == db_obj.driver_id).with_for_update()
        driver_res = await db.execute(driver_query)
        driver = driver_res.scalar_one()

        vehicle.status = VehicleStatus.AVAILABLE
        driver.status = DriverStatus.AVAILABLE
        db.add(vehicle)
        db.add(driver)

    try:
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during trip cancellation.",
        )
