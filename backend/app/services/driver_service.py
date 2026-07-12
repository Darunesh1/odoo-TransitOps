from datetime import date
import uuid
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.driver import Driver, DriverStatus
from app.schemas.driver import DriverCreate, DriverUpdate


async def get_driver_by_id(db: AsyncSession, driver_id: uuid.UUID) -> Optional[Driver]:
    """Retrieves a driver from the database by UUID."""
    query = select(Driver).where(Driver.id == driver_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_driver_by_license(db: AsyncSession, license_number: str) -> Optional[Driver]:
    """Retrieves a driver from the database by license number."""
    query = select(Driver).where(Driver.license_number == license_number.strip())
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def list_drivers(
    db: AsyncSession,
    *,
    status_filter: Optional[DriverStatus] = None,
    license_category: Optional[str] = None,
    expired: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Driver]:
    """Lists drivers with optional filters (status, license category, expiry status), search, and pagination."""
    query = select(Driver)
    today = date.today()

    if status_filter:
        query = query.where(Driver.status == status_filter)
    if license_category:
        query = query.where(Driver.license_category == license_category.strip())
    if expired is not None:
        if expired:
            query = query.where(Driver.license_expiry_date < today)
        else:
            query = query.where(Driver.license_expiry_date >= today)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Driver.name.ilike(search_term),
                Driver.license_number.ilike(search_term),
            )
        )

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def create_driver(db: AsyncSession, obj_in: DriverCreate) -> Driver:
    """Registers a new driver in the database, defaulting status to AVAILABLE."""
    db_driver = Driver(
        name=obj_in.name.strip(),
        license_number=obj_in.license_number.strip(),
        license_category=obj_in.license_category.strip(),
        license_expiry_date=obj_in.license_expiry_date,
        contact_number=obj_in.contact_number.strip() if obj_in.contact_number else None,
        safety_score=obj_in.safety_score,
        status=DriverStatus.AVAILABLE,
    )
    try:
        db.add(db_driver)
        await db.commit()
        await db.refresh(db_driver)
        return db_driver
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A driver with this license number already exists.",
        )
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during driver registration.",
        )


async def update_driver(
    db: AsyncSession, db_obj: Driver, obj_in: DriverUpdate
) -> Driver:
    """Updates selected driver attributes."""
    update_data = obj_in.model_dump(exclude_unset=True)

    if "license_number" in update_data:
        db_obj.license_number = update_data["license_number"].strip()
        del update_data["license_number"]

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
            detail="A driver with this license number already exists.",
        )
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during driver update.",
        )


async def suspend_driver(db: AsyncSession, db_obj: Driver) -> Driver:
    """Sets a driver status to SUSPENDED."""
    db_obj.status = DriverStatus.SUSPENDED
    try:
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during driver suspension.",
        )


async def activate_driver(db: AsyncSession, db_obj: Driver) -> Driver:
    """Sets a driver status to AVAILABLE."""
    db_obj.status = DriverStatus.AVAILABLE
    try:
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during driver activation.",
        )
