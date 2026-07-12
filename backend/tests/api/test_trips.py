from datetime import date, datetime, timedelta, timezone
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


async def setup_trip_resources(db_session: AsyncSession):
    """Helper to seed a valid AVAILABLE vehicle and a valid AVAILABLE driver."""
    vehicle = Vehicle(
        registration_number="TRIP-VEH-1",
        name="Delivery Van",
        vehicle_type="Van",
        max_load_capacity=2000.0,
        odometer=100.0,
        acquisition_cost=25000.00,
        status=VehicleStatus.AVAILABLE,
    )
    driver = Driver(
        name="John Driver",
        license_number="LIC-TRIP-999",
        license_category="Class C",
        license_expiry_date=date.today() + timedelta(days=30),
        status=DriverStatus.AVAILABLE,
    )
    db_session.add_all([vehicle, driver])
    await db_session.commit()
    return vehicle, driver


@pytest.mark.asyncio
async def test_dispatcher_core_trip_lifecycle(client: AsyncClient, db_session: AsyncSession):
    # Setup resources and Dispatcher user
    vehicle, driver = await setup_trip_resources(db_session)
    headers = await create_user_with_role(db_session, client, "dispatcher@test.com", "DISPATCHER")

    # 1. Create Trip (DRAFT status)
    payload = {
        "source": "Warehouse A",
        "destination": "Retail Outlet B",
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "cargo_weight": 1500.0,
        "planned_distance": 50.0,
        "revenue": 500.00,
    }
    response = await client.post("/trips/", headers=headers, json=payload)
    assert response.status_code == 201
    trip_data = response.json()
    assert trip_data["status"] == "DRAFT"
    assert trip_data["trip_number"] == "TRIP-000001"
    trip_uuid = trip_data["id"]

    # 2. Dispatch Trip
    response = await client.post(f"/trips/{trip_uuid}/dispatch", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "DISPATCHED"
    assert response.json()["start_odometer"] == 100.0

    # Verify vehicle and driver status are updated to ON_TRIP
    await db_session.refresh(vehicle)
    await db_session.refresh(driver)
    assert vehicle.status == VehicleStatus.ON_TRIP
    assert driver.status == DriverStatus.ON_TRIP

    # 3. Complete Trip
    complete_payload = {
        "final_odometer": 160.0,
        "fuel_consumed": 15.5,
    }
    response = await client.post(f"/trips/{trip_uuid}/complete", headers=headers, json=complete_payload)
    assert response.status_code == 200
    completed_data = response.json()
    assert completed_data["status"] == "COMPLETED"
    assert completed_data["final_odometer"] == 160.0

    # Verify vehicle and driver status return to AVAILABLE, and vehicle odometer updates
    await db_session.refresh(vehicle)
    await db_session.refresh(driver)
    assert vehicle.status == VehicleStatus.AVAILABLE
    assert driver.status == DriverStatus.AVAILABLE
    assert vehicle.odometer == 160.0


@pytest.mark.asyncio
async def test_trip_dispatch_validations(client: AsyncClient, db_session: AsyncSession):
    headers = await create_user_with_role(db_session, client, "dispatcher@test.com", "DISPATCHER")

    # 1. Overcapacity validation
    v_over = Vehicle(
        registration_number="V-OVER",
        name="Rig",
        vehicle_type="Truck",
        max_load_capacity=1000.0,  # Max 1000kg
        acquisition_cost=40000.0,
        status=VehicleStatus.AVAILABLE,
    )
    d_over = Driver(
        name="Alex",
        license_number="LIC-OVER",
        license_category="Class A",
        license_expiry_date=date.today() + timedelta(days=10),
        status=DriverStatus.AVAILABLE,
    )
    db_session.add_all([v_over, d_over])
    await db_session.commit()

    # Create trip with 1500kg cargo (over max 1000kg)
    payload = {
        "source": "A",
        "destination": "B",
        "vehicle_id": str(v_over.id),
        "driver_id": str(d_over.id),
        "cargo_weight": 1500.0,
        "planned_distance": 10.0,
        "revenue": 100.0,
    }
    response = await client.post("/trips/", headers=headers, json=payload)
    trip_uuid = response.json()["id"]

    # Dispatch -> should fail due to capacity limits
    response = await client.post(f"/trips/{trip_uuid}/dispatch", headers=headers)
    assert response.status_code == 400
    assert "exceeds vehicle maximum capacity" in response.json()["detail"]

    # 2. Expired driver license validation
    d_expired = Driver(
        name="Expired Guy",
        license_number="LIC-EXP",
        license_category="Class A",
        license_expiry_date=date.today() - timedelta(days=1),  # Expired yesterday
        status=DriverStatus.AVAILABLE,
    )
    db_session.add(d_expired)
    await db_session.commit()

    # Update trip to use expired driver
    response = await client.patch(f"/trips/{trip_uuid}", headers=headers, json={"driver_id": str(d_expired.id), "cargo_weight": 500.0})
    assert response.status_code == 200

    # Dispatch -> should fail due to expired license
    response = await client.post(f"/trips/{trip_uuid}/dispatch", headers=headers)
    assert response.status_code == 400
    assert "license is expired" in response.json()["detail"]


@pytest.mark.asyncio
async def test_trip_cancel_restores_resources(client: AsyncClient, db_session: AsyncSession):
    vehicle, driver = await setup_trip_resources(db_session)
    headers = await create_user_with_role(db_session, client, "dispatcher@test.com", "DISPATCHER")

    # Create & Dispatch
    payload = {
        "source": "A",
        "destination": "B",
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "cargo_weight": 500.0,
        "planned_distance": 10.0,
        "revenue": 100.0,
    }
    response = await client.post("/trips/", headers=headers, json=payload)
    trip_uuid = response.json()["id"]

    # Dispatch
    await client.post(f"/trips/{trip_uuid}/dispatch", headers=headers)

    # Cancel the dispatched trip
    response = await client.post(f"/trips/{trip_uuid}/cancel", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "CANCELLED"

    # Verify resources returned to AVAILABLE
    await db_session.refresh(vehicle)
    await db_session.refresh(driver)
    assert vehicle.status == VehicleStatus.AVAILABLE
    assert driver.status == DriverStatus.AVAILABLE


@pytest.mark.asyncio
async def test_dispatcher_permissions_and_unauthorized_roles(client: AsyncClient, db_session: AsyncSession):
    # Retrieve dispatcher role and create a mock dispatcher
    res = await db_session.execute(select(Role).where(Role.name == "DISPATCHER"))
    disp_role = res.scalar_one()
    dispatcher = User(
        email="disp_mock@test.com",
        hashed_password=hash_password("password123"),
        full_name="Mock Dispatcher",
        roles=[disp_role],
        is_active=True,
        is_verified=True,
    )
    db_session.add(dispatcher)
    await db_session.commit()

    vehicle, driver = await setup_trip_resources(db_session)

    # Create Draft Trip directly
    trip = Trip(
        trip_number="TRIP-TEST-99",
        source="A",
        destination="B",
        vehicle_id=vehicle.id,
        driver_id=driver.id,
        cargo_weight=500.0,
        planned_distance=20.0,
        status=TripStatus.DRAFT,
        created_by=dispatcher.id,
    )
    db_session.add(trip)
    await db_session.commit()

    # Safety Officer (Unauthorized to write/dispatch)
    so_headers = await create_user_with_role(db_session, client, "safety@test.com", "SAFETY_OFFICER")
    response = await client.post(f"/trips/{trip.id}/dispatch", headers=so_headers)
    assert response.status_code == 403

    # Safety Officer is authorized to read
    response = await client.get(f"/trips/{trip.id}", headers=so_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_concurrency_or_busy_resource_rejection(client: AsyncClient, db_session: AsyncSession):
    vehicle, driver = await setup_trip_resources(db_session)
    headers = await create_user_with_role(db_session, client, "dispatcher@test.com", "DISPATCHER")

    # Trip 1
    t1_res = await client.post("/trips/", headers=headers, json={
        "source": "A", "destination": "B",
        "vehicle_id": str(vehicle.id), "driver_id": str(driver.id),
        "cargo_weight": 500.0, "planned_distance": 10.0
    })
    t1_uuid = t1_res.json()["id"]

    # Trip 2 (shares the same vehicle and driver)
    t2_res = await client.post("/trips/", headers=headers, json={
        "source": "X", "destination": "Y",
        "vehicle_id": str(vehicle.id), "driver_id": str(driver.id),
        "cargo_weight": 500.0, "planned_distance": 10.0
    })
    t2_uuid = t2_res.json()["id"]

    # Dispatch Trip 1 successfully
    resp = await client.post(f"/trips/{t1_uuid}/dispatch", headers=headers)
    assert resp.status_code == 200

    # Dispatch Trip 2 -> should fail because vehicle/driver are now ON_TRIP
    resp = await client.post(f"/trips/{t2_uuid}/dispatch", headers=headers)
    assert resp.status_code == 400
    assert "is not available" in resp.json()["detail"]
