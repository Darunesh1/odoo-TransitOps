import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import Driver, Role, Trip, User, Vehicle
from app.models.driver import DriverStatus
from app.models.fuel_log import FuelLog
from app.models.maintenance_log import MaintenanceLog, MaintenanceStatus
from app.models.trip import TripStatus
from app.models.vehicle import VehicleStatus


async def create_user_with_role(
    db_session: AsyncSession,
    client: AsyncClient,
    email: str,
    role_name: str,
) -> dict:
    """Create a user with one role, log in, and return auth headers."""

    result = await db_session.execute(select(Role).where(Role.name == role_name))
    role = result.scalar_one()

    user = User(
        email=email,
        hashed_password=hash_password("password123"),
        full_name=f"{role_name} User",
        roles=[role],
        is_active=True,
        is_superuser=(role_name == "ADMIN"),
        is_verified=True,
    )

    db_session.add(user)
    await db_session.commit()

    response = await client.post(
        "/auth/login",
        data={
            "username": email,
            "password": "password123",
        },
    )

    tokens = response.json()

    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.mark.asyncio
async def test_analytics_summary_calculations(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_user_with_role(
        db_session,
        client,
        "analyst@test.com",
        "FINANCIAL_ANALYST",
    )

    result = await db_session.execute(
        select(User).where(User.email == "analyst@test.com")
    )
    analyst = result.scalar_one()

    vehicle = Vehicle(
        registration_number="ANALYTICS-VEH-1",
        name="Analytics Truck",
        vehicle_type="Truck",
        max_load_capacity=5000.0,
        odometer=1500.0,
        acquisition_cost=10000.0,
        status=VehicleStatus.AVAILABLE,
        region="North",
    )
    db_session.add(vehicle)
    await db_session.commit()

    driver_id = uuid.uuid4()
    driver = Driver(
        id=driver_id,
        name="Analytics Driver",
        license_number="LIC-ANALYTICS-1",
        license_category="Class A",
        license_expiry_date=date.today(),
        status=DriverStatus.AVAILABLE,
    )
    db_session.add(driver)
    await db_session.commit()
    await db_session.refresh(driver)

    trip = Trip(
        trip_number="TRIP-ANALYTICS-1",
        source="Chennai",
        destination="Bangalore",
        vehicle_id=vehicle.id,
        driver_id=driver_id,
        cargo_weight=1000.0,
        planned_distance=500.0,
        start_odometer=1000.0,
        final_odometer=1500.0,
        fuel_consumed=50.0,
        revenue=5000.0,
        status=TripStatus.COMPLETED,
        completed_at=datetime.now(timezone.utc),
        created_by=analyst.id,
    )
    db_session.add(trip)
    await db_session.commit()

    fuel_log = FuelLog(
        vehicle_id=vehicle.id,
        trip_id=trip.id,
        liters=50.0,
        cost=1000.0,
        date=date.today(),
        odometer=1500.0,
        created_by=analyst.id,
    )

    now = datetime.now(timezone.utc)
    maintenance = MaintenanceLog(
        vehicle_id=vehicle.id,
        maintenance_type="Oil Change",
        description="Routine maintenance",
        cost=500.0,
        status=MaintenanceStatus.COMPLETED,
        started_at=now,
        completed_at=now,
        created_by=analyst.id,
    )
    db_session.add_all([fuel_log, maintenance])
    await db_session.commit()

    response = await client.get("/analytics/summary", headers=headers)

    assert response.status_code == 200

    data = response.json()
    assert data["total_fuel_cost"] == 1000.0
    assert data["total_maintenance_cost"] == 500.0
    assert data["total_operational_cost"] == 1500.0
    assert data["total_other_expenses"] == 0.0
    assert data["total_revenue"] == 5000.0
    assert data["total_distance"] == 500.0
    assert data["total_fuel_consumed"] == 50.0
    assert data["fuel_efficiency"] == 10.0
    assert data["fleet_utilization"] == 0.0
    assert data["vehicle_roi"] == 35.0


@pytest.mark.asyncio
async def test_analytics_access_permissions(
    client: AsyncClient,
    db_session: AsyncSession,
):
    for role_name in [
        "FINANCIAL_ANALYST",
        "FLEET_MANAGER",
        "ADMIN",
    ]:
        headers = await create_user_with_role(
            db_session,
            client,
            f"{role_name.lower()}@test.com",
            role_name,
        )

        response = await client.get("/analytics/summary", headers=headers)
        assert response.status_code == 200

    for role_name in [
        "DISPATCHER",
        "SAFETY_OFFICER",
    ]:
        headers = await create_user_with_role(
            db_session,
            client,
            f"{role_name.lower()}@test.com",
            role_name,
        )

        response = await client.get("/analytics/summary", headers=headers)
        assert response.status_code == 403
        assert response.json()["detail"] == "Insufficient permissions"

    response = await client.get("/analytics/summary")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_analytics_region_filter(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_user_with_role(
        db_session,
        client,
        "filter-analyst@test.com",
        "FINANCIAL_ANALYST",
    )

    result = await db_session.execute(
        select(User).where(User.email == "filter-analyst@test.com")
    )
    analyst = result.scalar_one()

    north_vehicle = Vehicle(
        registration_number="ANALYTICS-NORTH-1",
        name="North Truck",
        vehicle_type="Truck",
        max_load_capacity=5000.0,
        odometer=1000.0,
        acquisition_cost=10000.0,
        status=VehicleStatus.AVAILABLE,
        region="North",
    )

    south_vehicle = Vehicle(
        registration_number="ANALYTICS-SOUTH-1",
        name="South Truck",
        vehicle_type="Truck",
        max_load_capacity=5000.0,
        odometer=1000.0,
        acquisition_cost=20000.0,
        status=VehicleStatus.AVAILABLE,
        region="South",
    )

    db_session.add_all([north_vehicle, south_vehicle])
    await db_session.commit()

    north_fuel = FuelLog(
        vehicle_id=north_vehicle.id,
        liters=50.0,
        cost=1000.0,
        date=date.today(),
        created_by=analyst.id,
    )

    south_fuel = FuelLog(
        vehicle_id=south_vehicle.id,
        liters=100.0,
        cost=2000.0,
        date=date.today(),
        created_by=analyst.id,
    )

    db_session.add_all([north_fuel, south_fuel])
    await db_session.commit()

    response = await client.get("/analytics/summary?region=North", headers=headers)

    assert response.status_code == 200

    data = response.json()
    assert data["total_fuel_cost"] == 1000.0
    assert data["total_maintenance_cost"] == 0.0
    assert data["total_operational_cost"] == 1000.0
    assert data["total_revenue"] == 0.0
    assert data["vehicle_roi"] == -10.0


@pytest.mark.asyncio
async def test_analytics_date_filter(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_user_with_role(
        db_session,
        client,
        "date-analyst@test.com",
        "FINANCIAL_ANALYST",
    )

    result = await db_session.execute(
        select(User).where(User.email == "date-analyst@test.com")
    )
    analyst = result.scalar_one()

    vehicle = Vehicle(
        registration_number="ANALYTICS-DATE-1",
        name="Date Filter Truck",
        vehicle_type="Truck",
        max_load_capacity=5000.0,
        odometer=1000.0,
        acquisition_cost=10000.0,
        status=VehicleStatus.AVAILABLE,
        region="North",
    )

    db_session.add(vehicle)
    await db_session.commit()

    today = date.today()
    old_date = today - timedelta(days=30)

    current_fuel = FuelLog(
        vehicle_id=vehicle.id,
        liters=50.0,
        cost=1000.0,
        date=today,
        created_by=analyst.id,
    )

    old_fuel = FuelLog(
        vehicle_id=vehicle.id,
        liters=100.0,
        cost=2000.0,
        date=old_date,
        created_by=analyst.id,
    )

    db_session.add_all([current_fuel, old_fuel])
    await db_session.commit()

    response = await client.get(
        "/analytics/summary",
        params={
            "date_from": today.isoformat(),
            "date_to": today.isoformat(),
        },
        headers=headers,
    )

    assert response.status_code == 200

    data = response.json()
    assert data["total_fuel_cost"] == 1000.0
    assert data["total_operational_cost"] == 1000.0
    assert data["vehicle_roi"] == -10.0


@pytest.mark.asyncio
async def test_export_analytics_csv(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_user_with_role(
        db_session,
        client,
        "export-analyst@test.com",
        "FINANCIAL_ANALYST",
    )

    response = await client.get("/analytics/export", headers=headers)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]

    content = response.text
    assert "Metric,Value" in content
    assert "Total Fuel Cost" in content
    assert "Vehicle ROI (%)" in content
