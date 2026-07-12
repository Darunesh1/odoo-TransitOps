from datetime import date
import uuid
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.vehicle import Vehicle
from app.models.trip import Trip
from app.schemas.expense import ExpenseCreate, ExpenseUpdate


async def get_expense_by_id(db: AsyncSession, expense_id: uuid.UUID) -> Optional[Expense]:
    """Retrieves an expense log from the database by UUID."""
    query = select(Expense).where(Expense.id == expense_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def list_expenses(
    db: AsyncSession,
    *,
    vehicle_id: Optional[uuid.UUID] = None,
    trip_id: Optional[uuid.UUID] = None,
    expense_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Expense]:
    """Lists expenses with optional filters and pagination."""
    query = select(Expense)

    if vehicle_id:
        query = query.where(Expense.vehicle_id == vehicle_id)
    if trip_id:
        query = query.where(Expense.trip_id == trip_id)
    if expense_type:
        query = query.where(Expense.expense_type == expense_type.strip())
    if date_from:
        query = query.where(Expense.date >= date_from)
    if date_to:
        query = query.where(Expense.date <= date_to)

    query = query.order_by(Expense.date.desc(), Expense.created_at.desc()).offset(skip).limit(limit)
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


async def create_expense(db: AsyncSession, obj_in: ExpenseCreate, creator_id: uuid.UUID) -> Expense:
    """Creates a new expense after verifying vehicle/trip relations."""
    await validate_vehicle_and_trip(db, obj_in.vehicle_id, obj_in.trip_id)

    db_expense = Expense(
        vehicle_id=obj_in.vehicle_id,
        trip_id=obj_in.trip_id,
        expense_type=obj_in.expense_type.strip(),
        description=obj_in.description.strip() if obj_in.description else None,
        amount=obj_in.amount,
        date=obj_in.date,
        created_by=creator_id,
    )
    try:
        db.add(db_expense)
        await db.commit()
        await db.refresh(db_expense)
        return db_expense
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during expense creation.",
        )


async def update_expense(
    db: AsyncSession, db_obj: Expense, obj_in: ExpenseUpdate
) -> Expense:
    """Updates attributes of an expense log, checking relations if IDs are updated."""
    v_id = obj_in.vehicle_id if obj_in.vehicle_id is not None else db_obj.vehicle_id
    t_id = obj_in.trip_id if obj_in.trip_id is not None else db_obj.trip_id

    if obj_in.vehicle_id is not None or obj_in.trip_id is not None:
        await validate_vehicle_and_trip(db, v_id, t_id)

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
            detail="Database error occurred during expense update.",
        )


async def delete_expense(db: AsyncSession, db_obj: Expense) -> Expense:
    """Deletes an expense from the database."""
    try:
        await db.delete(db_obj)
        await db.commit()
        return db_obj
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred during expense deletion.",
        )
