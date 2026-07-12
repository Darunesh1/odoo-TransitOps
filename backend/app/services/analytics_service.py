import uuid
from datetime import date, datetime, time, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.fuel_log import FuelLog
from app.models.maintenance_log import MaintenanceLog, MaintenanceStatus
from app.models.trip import Trip, TripStatus
from app.models.vehicle import Vehicle, VehicleStatus
from app.schemas.analytics import AnalyticsSummary


async def get_analytics_summary(
    db: AsyncSession,
    *,
    vehicle_id: Optional[uuid.UUID] = None,
    vehicle_type: Optional[str] = None,
    region: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> AnalyticsSummary:
    """Calculate aggregated operational and financial analytics."""

    # Convert date filters into timezone-aware datetime boundaries
    # for tables that store DateTime fields.
    datetime_from = (
        datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        if date_from
        else None
    )
    datetime_to = (
        datetime.combine(date_to, time.max, tzinfo=timezone.utc) if date_to else None
    )

    def apply_vehicle_filters(query):
        """Apply common vehicle filters to a query containing Vehicle."""
        if vehicle_id:
            query = query.where(Vehicle.id == vehicle_id)

        if vehicle_type:
            query = query.where(Vehicle.vehicle_type == vehicle_type.strip())

        if region:
            query = query.where(Vehicle.region == region.strip())

        return query

    # ---------------------------------------------------------
    # 1. Total Fuel Cost
    # ---------------------------------------------------------
    fuel_query = select(func.coalesce(func.sum(FuelLog.cost), 0)).join(
        Vehicle, Vehicle.id == FuelLog.vehicle_id
    )

    fuel_query = apply_vehicle_filters(fuel_query)

    if date_from:
        fuel_query = fuel_query.where(FuelLog.date >= date_from)

    if date_to:
        fuel_query = fuel_query.where(FuelLog.date <= date_to)

    fuel_result = await db.execute(fuel_query)
    total_fuel_cost = float(fuel_result.scalar() or 0)

    # ---------------------------------------------------------
    # 2. Total Maintenance Cost
    # Only completed maintenance is counted as finalized cost.
    # ---------------------------------------------------------
    maintenance_query = (
        select(func.coalesce(func.sum(MaintenanceLog.cost), 0))
        .join(Vehicle, Vehicle.id == MaintenanceLog.vehicle_id)
        .where(MaintenanceLog.status == MaintenanceStatus.COMPLETED)
    )

    maintenance_query = apply_vehicle_filters(maintenance_query)

    if datetime_from:
        maintenance_query = maintenance_query.where(
            MaintenanceLog.completed_at >= datetime_from
        )

    if datetime_to:
        maintenance_query = maintenance_query.where(
            MaintenanceLog.completed_at <= datetime_to
        )

    maintenance_result = await db.execute(maintenance_query)
    total_maintenance_cost = float(maintenance_result.scalar() or 0)

    # ---------------------------------------------------------
    # 3. Other Expenses
    # Kept separate from required operational cost.
    # ---------------------------------------------------------
    expense_query = select(func.coalesce(func.sum(Expense.amount), 0)).join(
        Vehicle, Vehicle.id == Expense.vehicle_id
    )

    expense_query = apply_vehicle_filters(expense_query)

    if date_from:
        expense_query = expense_query.where(Expense.date >= date_from)

    if date_to:
        expense_query = expense_query.where(Expense.date <= date_to)

    expense_result = await db.execute(expense_query)
    total_other_expenses = float(expense_result.scalar() or 0)

    # ---------------------------------------------------------
    # 4. Completed Trip Analytics
    # Revenue, actual distance and fuel consumed.
    # ---------------------------------------------------------
    trip_query = (
        select(
            func.coalesce(func.sum(Trip.revenue), 0),
            func.coalesce(
                func.sum(Trip.final_odometer - Trip.start_odometer),
                0,
            ),
            func.coalesce(func.sum(Trip.fuel_consumed), 0),
        )
        .join(Vehicle, Vehicle.id == Trip.vehicle_id)
        .where(
            Trip.status == TripStatus.COMPLETED,
            Trip.start_odometer.is_not(None),
            Trip.final_odometer.is_not(None),
        )
    )

    trip_query = apply_vehicle_filters(trip_query)

    if datetime_from:
        trip_query = trip_query.where(Trip.completed_at >= datetime_from)

    if datetime_to:
        trip_query = trip_query.where(Trip.completed_at <= datetime_to)

    trip_result = await db.execute(trip_query)
    trip_row = trip_result.one()

    total_revenue = float(trip_row[0] or 0)
    total_distance = float(trip_row[1] or 0)
    total_fuel_consumed = float(trip_row[2] or 0)

    # ---------------------------------------------------------
    # 5. Fuel Efficiency
    # ---------------------------------------------------------
    fuel_efficiency = 0.0

    if total_fuel_consumed > 0:
        fuel_efficiency = round(
            total_distance / total_fuel_consumed,
            2,
        )

    # ---------------------------------------------------------
    # 6. Fleet Utilization
    # Current fleet snapshot:
    # ON_TRIP vehicles / non-RETIRED vehicles * 100
    # ---------------------------------------------------------
    active_vehicle_query = select(func.count(Vehicle.id)).where(
        Vehicle.status != VehicleStatus.RETIRED
    )

    active_vehicle_query = apply_vehicle_filters(active_vehicle_query)

    active_vehicle_result = await db.execute(active_vehicle_query)
    active_vehicles = active_vehicle_result.scalar() or 0

    on_trip_vehicle_query = select(func.count(Vehicle.id)).where(
        Vehicle.status == VehicleStatus.ON_TRIP
    )

    on_trip_vehicle_query = apply_vehicle_filters(on_trip_vehicle_query)

    on_trip_vehicle_result = await db.execute(on_trip_vehicle_query)
    on_trip_vehicles = on_trip_vehicle_result.scalar() or 0

    fleet_utilization = 0.0

    if active_vehicles > 0:
        fleet_utilization = round(
            (on_trip_vehicles / active_vehicles) * 100,
            2,
        )

    # ---------------------------------------------------------
    # 7. Total Acquisition Cost
    # Used for fleet/filtered vehicle ROI.
    # ---------------------------------------------------------
    acquisition_query = select(func.coalesce(func.sum(Vehicle.acquisition_cost), 0))

    acquisition_query = apply_vehicle_filters(acquisition_query)

    acquisition_result = await db.execute(acquisition_query)
    total_acquisition_cost = float(acquisition_result.scalar() or 0)

    # ---------------------------------------------------------
    # 8. Operational Cost and ROI
    # ---------------------------------------------------------
    total_operational_cost = total_fuel_cost + total_maintenance_cost

    vehicle_roi = 0.0

    if total_acquisition_cost > 0:
        vehicle_roi = round(
            ((total_revenue - total_operational_cost) / total_acquisition_cost) * 100,
            2,
        )

    return AnalyticsSummary(
        total_fuel_cost=round(total_fuel_cost, 2),
        total_maintenance_cost=round(
            total_maintenance_cost,
            2,
        ),
        total_operational_cost=round(
            total_operational_cost,
            2,
        ),
        total_other_expenses=round(
            total_other_expenses,
            2,
        ),
        total_revenue=round(total_revenue, 2),
        total_distance=round(total_distance, 2),
        total_fuel_consumed=round(
            total_fuel_consumed,
            2,
        ),
        fuel_efficiency=fuel_efficiency,
        fleet_utilization=fleet_utilization,
        vehicle_roi=vehicle_roi,
    )
