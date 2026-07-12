from datetime import date, timedelta
import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Role, Vehicle, Driver, Trip, TripStatus
from app.models.vehicle import VehicleStatus
from app.models.driver import DriverStatus
from app.core.security import hash_password


async def create_user_with_role(db_session: AsyncSession, client: AsyncClient, email: str, role_name: str) -> dict:
    """Helper to register a user with a specific role, log in, and return headers."""
    res = await db_session.execute(select(Role).where(Role.name == role_name))
    role_obj = res.scalar_one()

    user = User(
        email=email,
        hashed_password=hash_password("password123"),
        full_name=f"{role_name} User",
        roles=[role_obj],
        is_active=True,
        is_superuser=(role_name == "ADMIN"),
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()

    # Log in
    login_data = {"username": email, "password": "password123"}
    response = await client.post("/auth/login", data=login_data)
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.mark.asyncio
async def test_dashboard_kpi_aggregation(client: AsyncClient, db_session: AsyncSession):
    # 1. Seed Vehicles
    v_avail = Vehicle(
        registration_number="DASH-VEH-1",
        name="FE Cargo Truck",
        vehicle_type="Truck",
        max_load_capacity=5000.0,
        odometer=500.0,
        acquisition_cost=55000.00,
        status=VehicleStatus.AVAILABLE,
        region="North",
    )
    v_shop = Vehicle(
        registration_number="DASH-VEH-2",
        name="FE Van",
        vehicle_type="Van",
        max_load_capacity=1500.0,
        odometer=100.0,
        acquisition_cost=20000.00,
        status=VehicleStatus.IN_SHOP,
        region="South",
    )
    v_retired = Vehicle(
        registration_number="DASH-VEH-3",
        name="Old Truck",
        vehicle_type="Truck",
        max_load_capacity=4000.0,
        odometer=300000.0,
        acquisition_cost=10000.00,
        status=VehicleStatus.RETIRED,
        region="North",
    )
    db_session.add_all([v_avail, v_shop, v_retired])
    await db_session.commit()

    # 2. Seed Driver & User
    driver = Driver(
        name="FE Driver",
        license_number="LIC-DASH-1",
        license_category="Class A CDL",
        license_expiry_date=date.today() + timedelta(days=200),
        status=DriverStatus.AVAILABLE,
    )
    res = await db_session.execute(select(Role).where(Role.name == "DISPATCHER"))
    disp_role = res.scalar_one()
    creator_user = User(
        email="creator-dash@test.com",
        hashed_password=hash_password("password123"),
        full_name="Trip Creator",
        roles=[disp_role],
        is_active=True,
        is_verified=True,
    )
    db_session.add_all([driver, creator_user])
    await db_session.commit()

    # 3. Seed Draft Trip
    trip = Trip(
        trip_number="TRIP-DASH-1",
        source="A",
        destination="B",
        vehicle_id=v_avail.id,
        driver_id=driver.id,
        cargo_weight=1000.0,
        planned_distance=150.0,
        status=TripStatus.DRAFT,
        created_by=creator_user.id,
    )
    db_session.add(trip)
    await db_session.commit()

    # Log in as Fleet Manager
    headers = await create_user_with_role(db_session, client, "manager@test.com", "FLEET_MANAGER")

    # Fetch KPIs (no filters)
    response = await client.get("/dashboard/kpis", headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["active_vehicles"] == 2  # (v_avail, v_shop)
    assert data["available_vehicles"] == 1  # (v_avail)
    assert data["vehicles_in_maintenance"] == 1  # (v_shop)
    assert data["active_trips"] == 0
    assert data["pending_trips"] == 1
    assert data["drivers_on_duty"] == 0
    assert data["fleet_utilization"] == 0.0

    # Fetch KPIs with filter (North region only)
    response = await client.get("/dashboard/kpis?region=North", headers=headers)
    assert response.status_code == 200
    data_north = response.json()
    assert data_north["active_vehicles"] == 1  # v_avail only (v_retired is RETIRED, v_shop is South)
    assert data_north["available_vehicles"] == 1
    assert data_north["vehicles_in_maintenance"] == 0


@pytest.mark.asyncio
async def test_dashboard_fleet_utilization(client: AsyncClient, db_session: AsyncSession):
    # Seed 1 AVAILABLE vehicle, 1 Driver, 1 Dispatcher User
    vehicle = Vehicle(
        registration_number="DASH-VEH-UTIL",
        name="FE Truck",
        vehicle_type="Truck",
        max_load_capacity=5000.0,
        odometer=500.0,
        acquisition_cost=50000.00,
        status=VehicleStatus.AVAILABLE,
    )
    driver = Driver(
        name="FE Driver",
        license_number="LIC-DASH-UTIL",
        license_category="Class A",
        license_expiry_date=date.today() + timedelta(days=200),
        status=DriverStatus.AVAILABLE,
    )
    headers = await create_user_with_role(db_session, client, "disp@test.com", "DISPATCHER")

    # Get user object
    user_query = select(User).where(User.email == "disp@test.com")
    user_res = await db_session.execute(user_query)
    dispatcher_user = user_res.scalar_one()

    db_session.add_all([vehicle, driver])
    await db_session.commit()

    # Create & Dispatch Trip
    trip = Trip(
        trip_number="TRIP-DASH-UTIL",
        source="A",
        destination="B",
        vehicle_id=vehicle.id,
        driver_id=driver.id,
        cargo_weight=1000.0,
        planned_distance=150.0,
        status=TripStatus.DRAFT,
        created_by=dispatcher_user.id,
    )
    db_session.add(trip)
    await db_session.commit()

    # Dispatch Trip
    resp = await client.post(f"/trips/{trip.id}/dispatch", headers=headers)
    assert resp.status_code == 200

    # Fetch KPIs -> fleet utilization should be 100% (1 active vehicle, 1 ON_TRIP)
    resp = await client.get("/dashboard/kpis", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_vehicles"] == 1
    assert data["active_trips"] == 1
    assert data["drivers_on_duty"] == 1
    assert data["fleet_utilization"] == 100.0
