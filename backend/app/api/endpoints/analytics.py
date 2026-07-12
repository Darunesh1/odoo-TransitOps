import csv
import io
import uuid
from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
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


@router.get("/export")
async def export_analytics_csv(
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
):
    """Export analytics summary as CSV."""

    summary = await analytics_service.get_analytics_summary(
        db,
        vehicle_id=vehicle_id,
        vehicle_type=vehicle_type,
        region=region,
        date_from=date_from,
        date_to=date_to,
    )

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Metric",
        "Value",
    ])

    writer.writerows([
        ["Total Fuel Cost", summary.total_fuel_cost],
        ["Total Maintenance Cost", summary.total_maintenance_cost],
        ["Total Operational Cost", summary.total_operational_cost],
        ["Total Other Expenses", summary.total_other_expenses],
        ["Total Revenue", summary.total_revenue],
        ["Total Distance", summary.total_distance],
        ["Total Fuel Consumed", summary.total_fuel_consumed],
        ["Fuel Efficiency", summary.fuel_efficiency],
        ["Fleet Utilization (%)", summary.fleet_utilization],
        ["Vehicle ROI (%)", summary.vehicle_roi],
    ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="transitops_analytics.csv"'
        },
    )
