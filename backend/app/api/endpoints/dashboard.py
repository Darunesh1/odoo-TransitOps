from typing import Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, role_required
from app.models.user import User, UserRole
from app.models.vehicle import VehicleStatus
from app.schemas.dashboard import DashboardKPIs
from app.services import dashboard_service

router = APIRouter()


@router.get("/kpis", response_model=DashboardKPIs)
async def read_dashboard_kpis(
    vehicle_type: Optional[str] = Query(default=None),
    vehicle_status: Optional[VehicleStatus] = Query(default=None),
    region: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        role_required(UserRole.DISPATCHER, UserRole.FLEET_MANAGER, UserRole.SAFETY_OFFICER, UserRole.FINANCIAL_ANALYST)
    ),
) -> Any:
    """Retrieves aggregated fleet Key Performance Indicators. Accessible to all four operational roles and Admins."""
    return await dashboard_service.get_dashboard_kpis(
        db,
        vehicle_type=vehicle_type,
        vehicle_status=vehicle_status,
        region=region,
    )
