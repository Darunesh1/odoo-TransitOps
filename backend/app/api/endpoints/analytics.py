import uuid
from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, role_required
from app.models.user import User, UserRole
from app.schemas.analytics import AnalyticsSummary
from app.services import analytics_service

router = APIRouter()


@router.get("/summary", response_model=AnalyticsSummary)
async def read_analytics_summary(
    vehicle_id: Optional[uuid.UUID] = Query(default=None),
    vehicle_type: Optional[str] = Query(default=None),
    region: Optional[str] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(
            UserRole.FINANCIAL_ANALYST,
            UserRole.FLEET_MANAGER,
        )
    ),
) -> Any:
    """Return aggregated operational and financial analytics."""

    return await analytics_service.get_analytics_summary(
        db,
        vehicle_id=vehicle_id,
        vehicle_type=vehicle_type,
        region=region,
        date_from=date_from,
        date_to=date_to,
    )
