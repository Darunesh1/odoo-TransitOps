from datetime import datetime, timezone
import uuid
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.maintenance_log import MaintenanceLog, MaintenanceStatus
from app.models.vehicle import Vehicle, VehicleStatus
from app.schemas.maintenance import MaintenanceCreate, MaintenanceUpdate


async def get_maintenance_by_id(db: AsyncSession, log_id: uuid.UUID) -> Optional[MaintenanceLog]:
    """Retrieves a maintenance log from the database by UUID."""
    query = select(MaintenanceLog).where(MaintenanceLog.id == log_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def list_maintenance_logs(
    db: AsyncSession,
    *,
    vehicle_id: Optional[uuid.UUID] = None,
    status_filter: Optional[MaintenanceStatus] = None,
    maintenance_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[MaintenanceLog]:
    """Lists maintenance logs with optional filters, search, and pagination."""
    query = select(MaintenanceLog)

    if vehicle_id:
        query = query.where(MaintenanceLog.vehicle_id == vehicle_id)
    if status_filter:
        query = query.where(MaintenanceLog.status == status_filter)
    if maintenance_type:
        query = query.where(MaintenanceLog.maintenance_type == maintenance_type.strip())
    if start_date:
        query = query.where(MaintenanceLog.started_at >= start_date)
    if end_date:
        query = query.where(MaintenanceLog.started_at <= end_date)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                MaintenanceLog.maintenance_type.ilike(search_term),
                MaintenanceLog.description.ilike(search_term),
            )
        )

    query = query.order_by(MaintenanceLog.started_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def create_maintenance_log(db: AsyncSession, obj_in: MaintenanceCreate, creator_id: uuid.UUID) -> MaintenanceLog:
    """Creates a new active maintenance log for a vehicle. Locks the vehicle and marks its status as IN_SHOP."""
    # 1. Fetch and Lock Vehicle
    vehicle_query = select(Vehicle).where(Vehicle.id == obj_in.vehicle_id).with_for_update()
    vehicle_res = await db.execute(vehicle_query)
    vehicle = vehicle_res.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle assigned to this maintenance does not exist.",
        )
    if vehicle.status == VehicleStatus.ON_TRIP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot place a vehicle in maintenance while it is actively on a trip.",
        )
    if vehicle.status == VehicleStatus.IN_SHOP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This vehicle already has an active maintenance record and is already in shop.",
        )
    if vehicle.status == VehicleStatus.RETIRED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot place a retired vehicle in maintenance.",
        )

    # 2. Create ACTIVE maintenance log
    db_log = MaintenanceLog(
        vehicle_id=obj_in.vehicle_id,
        maintenance_type=obj_in.maintenance_type.strip(),
        description=obj_in.description.strip() if obj_in.description else None,
        cost=obj_in.cost,
        status=MaintenanceStatus.ACTIVE,
        started_at=obj_in.started_at,
        created_by=creator_id,
    )
    # 3. Transition Vehicle Status to IN_SHOP
    vehicle.status = VehicleStatus.IN_SHOP

    try:
        db.add(db_log)
        db.add(vehicle)
        await db.commit()
        await db.refresh(db_log)
        return db_log
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during maintenance creation.",
        )


async def update_maintenance_log(
    db: AsyncSession, db_obj: MaintenanceLog, obj_in: MaintenanceUpdate
) -> MaintenanceLog:
    """Updates attributes of an active maintenance log."""
    if db_obj.status != MaintenanceStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only ACTIVE maintenance logs can be updated.",
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
            detail="Database error occurred during maintenance update.",
        )


async def complete_maintenance_log(db: AsyncSession, db_obj: MaintenanceLog) -> MaintenanceLog:
    """Completes an active maintenance log. Restores the vehicle to AVAILABLE status."""
    if db_obj.status != MaintenanceStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only ACTIVE maintenance logs can be completed.",
        )

    # Fetch and Lock Vehicle
    vehicle_query = select(Vehicle).where(Vehicle.id == db_obj.vehicle_id).with_for_update()
    vehicle_res = await db.execute(vehicle_query)
    vehicle = vehicle_res.scalar_one()

    # Transition statuses
    db_obj.status = MaintenanceStatus.COMPLETED
    db_obj.completed_at = datetime.now(timezone.utc)

    # Restores vehicle to AVAILABLE if it is currently IN_SHOP (unless retired)
    if vehicle.status == VehicleStatus.IN_SHOP:
        vehicle.status = VehicleStatus.AVAILABLE

    try:
        db.add(db_obj)
        db.add(vehicle)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during maintenance completion.",
        )


async def cancel_maintenance_log(db: AsyncSession, db_obj: MaintenanceLog) -> MaintenanceLog:
    """Cancels an active maintenance log. Restores the vehicle to AVAILABLE status."""
    if db_obj.status != MaintenanceStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only ACTIVE maintenance logs can be cancelled.",
        )

    # Fetch and Lock Vehicle
    vehicle_query = select(Vehicle).where(Vehicle.id == db_obj.vehicle_id).with_for_update()
    vehicle_res = await db.execute(vehicle_query)
    vehicle = vehicle_res.scalar_one()

    # Transition statuses
    db_obj.status = MaintenanceStatus.CANCELLED
    db_obj.completed_at = datetime.now(timezone.utc)

    # Restores vehicle to AVAILABLE if it is currently IN_SHOP (unless retired)
    if vehicle.status == VehicleStatus.IN_SHOP:
        vehicle.status = VehicleStatus.AVAILABLE

    try:
        db.add(db_obj)
        db.add(vehicle)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during maintenance cancellation.",
        )
