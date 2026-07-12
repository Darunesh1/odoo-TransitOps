from datetime import date
import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, role_required
from app.models.user import User, UserRole
from app.schemas.expense import ExpenseCreate, ExpenseRead, ExpenseUpdate
from app.services import expense_service

router = APIRouter()


@router.post("/", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
async def create_new_expense(
    expense_in: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FINANCIAL_ANALYST)),
) -> Any:
    """Registers a new expense. Accessible to Financial Analysts and Admins."""
    return await expense_service.create_expense(db, obj_in=expense_in, creator_id=current_user.id)


@router.get("/", response_model=List[ExpenseRead])
async def read_expenses(
    vehicle_id: Optional[uuid.UUID] = Query(default=None),
    trip_id: Optional[uuid.UUID] = Query(default=None),
    expense_type: Optional[str] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.FINANCIAL_ANALYST, UserRole.FLEET_MANAGER)
    ),
) -> Any:
    """Lists expenses with filtering and pagination. Accessible to Financial Analysts, Fleet Managers, and Admins."""
    return await expense_service.list_expenses(
        db,
        vehicle_id=vehicle_id,
        trip_id=trip_id,
        expense_type=expense_type,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )


@router.get("/{id}", response_model=ExpenseRead)
async def read_expense(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.FINANCIAL_ANALYST, UserRole.FLEET_MANAGER)
    ),
) -> Any:
    """Retrieves details of a single expense. Accessible to Financial Analysts, Fleet Managers, and Admins."""
    expense = await expense_service.get_expense_by_id(db, expense_id=id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found.",
        )
    return expense


@router.patch("/{id}", response_model=ExpenseRead)
async def update_expense_details(
    id: uuid.UUID,
    expense_in: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FINANCIAL_ANALYST)),
) -> Any:
    """Updates details of an existing expense. Accessible to Financial Analysts and Admins."""
    expense = await expense_service.get_expense_by_id(db, expense_id=id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found.",
        )
    return await expense_service.update_expense(db, db_obj=expense, obj_in=expense_in)


@router.delete("/{id}", response_model=ExpenseRead)
async def delete_expense_record(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required(UserRole.FINANCIAL_ANALYST)),
) -> Any:
    """Deletes an existing expense. Accessible to Financial Analysts and Admins."""
    expense = await expense_service.get_expense_by_id(db, expense_id=id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found.",
        )
    return await expense_service.delete_expense(db, db_obj=expense)
