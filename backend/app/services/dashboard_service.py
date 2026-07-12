import uuid
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vehicle import Vehicle, VehicleStatus
from app.models.driver import Driver, DriverStatus
from app.models.trip import Trip, TripStatus
from app.schemas.dashboard import DashboardKPIs


async def get_dashboard_kpis(
    db: AsyncSession,
    *,
    vehicle_type: Optional[str] = None,
    vehicle_status: Optional[VehicleStatus] = None,
    region: Optional[str] = None,
) -> DashboardKPIs:
    """Aggregates dashboard KPI counts applying vehicle filters (type, status, region)."""
    # 1. Base vehicle query filter helper
    def apply_vehicle_filters(query):
        if vehicle_type:
            query = query.where(Vehicle.vehicle_type == vehicle_type.strip())
        if vehicle_status:
            query = query.where(Vehicle.status == vehicle_status)
        if region:
            query = query.where(Vehicle.region == region.strip())
        return query

    # 2. Count Active Vehicles (not RETIRED)
    active_veh_query = select(func.count(Vehicle.id)).where(Vehicle.status != VehicleStatus.RETIRED)
    active_veh_query = apply_vehicle_filters(active_veh_query)
    active_veh_res = await db.execute(active_veh_query)
    active_vehicles = active_veh_res.scalar() or 0

    # 3. Count Available Vehicles (AVAILABLE)
    avail_veh_query = select(func.count(Vehicle.id)).where(Vehicle.status == VehicleStatus.AVAILABLE)
    avail_veh_query = apply_vehicle_filters(avail_veh_query)
    avail_veh_res = await db.execute(avail_veh_query)
    available_vehicles = avail_veh_res.scalar() or 0

    # 4. Count Vehicles in Maintenance (IN_SHOP)
    maint_veh_query = select(func.count(Vehicle.id)).where(Vehicle.status == VehicleStatus.IN_SHOP)
    maint_veh_query = apply_vehicle_filters(maint_veh_query)
    maint_veh_res = await db.execute(maint_veh_query)
    vehicles_in_maintenance = maint_veh_res.scalar() or 0

    # 5. Count Active Trips (DISPATCHED status)
    active_trip_query = select(func.count(Trip.id)).join(Vehicle).where(Trip.status == TripStatus.DISPATCHED)
    active_trip_query = apply_vehicle_filters(active_trip_query)
    active_trip_res = await db.execute(active_trip_query)
    active_trips = active_trip_res.scalar() or 0

    # 6. Count Pending Trips (DRAFT status)
    pending_trip_query = select(func.count(Trip.id)).join(Vehicle).where(Trip.status == TripStatus.DRAFT)
    pending_trip_query = apply_vehicle_filters(pending_trip_query)
    pending_trip_res = await db.execute(pending_trip_query)
    pending_trips = pending_trip_res.scalar() or 0

    # 7. Count Drivers On Duty (status ON_TRIP)
    # Join Driver -> Trip (DISPATCHED) -> Vehicle to apply vehicle filters correctly if present
    drivers_query = select(func.count(Driver.id)).where(Driver.status == DriverStatus.ON_TRIP)
    if vehicle_type or vehicle_status or region:
        drivers_query = (
            select(func.count(func.distinct(Driver.id)))
            .join(Trip, Trip.driver_id == Driver.id)
            .join(Vehicle, Vehicle.id == Trip.vehicle_id)
            .where(Trip.status == TripStatus.DISPATCHED)
        )
        drivers_query = apply_vehicle_filters(drivers_query)

    drivers_res = await db.execute(drivers_query)
    drivers_on_duty = drivers_res.scalar() or 0

    # 8. Fleet Utilization (%)
    # ON_TRIP vehicles / non-RETIRED vehicles * 100
    on_trip_veh_query = select(func.count(Vehicle.id)).where(Vehicle.status == VehicleStatus.ON_TRIP)
    on_trip_veh_query = apply_vehicle_filters(on_trip_veh_query)
    on_trip_veh_res = await db.execute(on_trip_veh_query)
    on_trip_vehicles = on_trip_veh_res.scalar() or 0

    fleet_utilization = 0.0
    if active_vehicles > 0:
        fleet_utilization = round((on_trip_vehicles / active_vehicles) * 100, 2)

    return DashboardKPIs(
        active_vehicles=active_vehicles,
        available_vehicles=available_vehicles,
        vehicles_in_maintenance=vehicles_in_maintenance,
        active_trips=active_trips,
        pending_trips=pending_trips,
        drivers_on_duty=drivers_on_duty,
        fleet_utilization=fleet_utilization,
    )
