from datetime import date, timedelta
import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Role, Vehicle, Trip, FuelLog, Expense, TripStatus, Driver
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


async def setup_fuel_expense_resources(db_session: AsyncSession):
    """Helper to seed a vehicle, a driver, a user, and a trip for testing fuel logs and expenses."""
    vehicle1 = Vehicle(
        registration_number=f"VEH-FE1-{uuid.uuid4().hex[:4]}",
        name="FE Cargo Truck",
        vehicle_type="Truck",
        max_load_capacity=5000.0,
        odometer=500.0,
        acquisition_cost=55000.00,
        status=VehicleStatus.AVAILABLE,
    )
    vehicle2 = Vehicle(
        registration_number=f"VEH-FE2-{uuid.uuid4().hex[:4]}",
        name="FE Van",
        vehicle_type="Van",
        max_load_capacity=1500.0,
        odometer=100.0,
        acquisition_cost=20000.00,
        status=VehicleStatus.AVAILABLE,
    )
    driver = Driver(
        name="FE Driver",
        license_number=f"LIC-FE-{uuid.uuid4().hex[:4]}",
        license_category="Class A CDL",
        license_expiry_date=date.today() + timedelta(days=200),
        status=DriverStatus.AVAILABLE,
    )
    # Create a user to act as trip creator
    res = await db_session.execute(select(Role).where(Role.name == "DISPATCHER"))
    disp_role = res.scalar_one()
    creator_user = User(
        email=f"creator-{uuid.uuid4().hex[:4]}@test.com",
        hashed_password=hash_password("password123"),
        full_name="Trip Creator",
        roles=[disp_role],
        is_active=True,
        is_verified=True,
    )

    db_session.add_all([vehicle1, vehicle2, driver, creator_user])
    await db_session.commit()

    trip = Trip(
        trip_number=f"TRIP-FE-{uuid.uuid4().hex[:4]}",
        source="Factory",
        destination="Warehouse",
        vehicle_id=vehicle1.id,
        driver_id=driver.id,
        cargo_weight=1000.0,
        planned_distance=150.0,
        status=TripStatus.DRAFT,
        created_by=creator_user.id,
    )
    db_session.add(trip)
    await db_session.commit()

    return vehicle1, vehicle2, trip


@pytest.mark.asyncio
async def test_financial_analyst_fuel_log_crud_flow(client: AsyncClient, db_session: AsyncSession):
    v1, v2, trip = await setup_fuel_expense_resources(db_session)
    headers = await create_user_with_role(db_session, client, "analyst@test.com", "FINANCIAL_ANALYST")

    # 1. Create Fuel Log
    payload = {
        "vehicle_id": str(v1.id),
        "trip_id": str(trip.id),
        "liters": 45.5,
        "cost": 90.00,
        "date": str(date.today()),
        "odometer": 545.0,
    }
    response = await client.post("/fuel-logs/", headers=headers, json=payload)
    assert response.status_code == 201
    log_data = response.json()
    assert log_data["liters"] == 45.5
    assert log_data["cost"] == 90.0
    log_uuid = log_data["id"]

    # 2. Read Fuel Log
    response = await client.get(f"/fuel-logs/{log_uuid}", headers=headers)
    assert response.status_code == 200
    assert response.json()["liters"] == 45.5

    # 3. Update Fuel Log
    response = await client.patch(
        f"/fuel-logs/{log_uuid}", headers=headers, json={"liters": 50.0}
    )
    assert response.status_code == 200
    assert response.json()["liters"] == 50.0

    # 4. Delete Fuel Log
    response = await client.delete(f"/fuel-logs/{log_uuid}", headers=headers)
    assert response.status_code == 200

    # Read -> should be 404
    response = await client.get(f"/fuel-logs/{log_uuid}", headers=headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_financial_analyst_expense_crud_flow(client: AsyncClient, db_session: AsyncSession):
    v1, v2, trip = await setup_fuel_expense_resources(db_session)
    headers = await create_user_with_role(db_session, client, "analyst@test.com", "FINANCIAL_ANALYST")

    # 1. Create Expense
    payload = {
        "vehicle_id": str(v1.id),
        "trip_id": str(trip.id),
        "expense_type": "TOLL",
        "description": "Expressway toll tax",
        "amount": 25.50,
        "date": str(date.today()),
    }
    response = await client.post("/expenses/", headers=headers, json=payload)
    assert response.status_code == 201
    expense_data = response.json()
    assert expense_data["expense_type"] == "TOLL"
    assert expense_data["amount"] == 25.50
    expense_uuid = expense_data["id"]

    # 2. Read Expense
    response = await client.get(f"/expenses/{expense_uuid}", headers=headers)
    assert response.status_code == 200
    assert response.json()["amount"] == 25.50

    # 3. Update Expense
    response = await client.patch(
        f"/expenses/{expense_uuid}", headers=headers, json={"amount": 30.00}
    )
    assert response.status_code == 200
    assert response.json()["amount"] == 30.00

    # 4. Delete Expense
    response = await client.delete(f"/expenses/{expense_uuid}", headers=headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_fuel_and_expense_input_validations(client: AsyncClient, db_session: AsyncSession):
    v1, v2, trip = await setup_fuel_expense_resources(db_session)
    headers = await create_user_with_role(db_session, client, "analyst@test.com", "FINANCIAL_ANALYST")

    # 1. Negative cost/liters validation
    payload = {
        "vehicle_id": str(v1.id),
        "trip_id": str(trip.id),
        "liters": -5.0,  # Negative
        "cost": 10.0,
        "date": str(date.today()),
    }
    response = await client.post("/fuel-logs/", headers=headers, json=payload)
    assert response.status_code == 422

    # 2. Unknown vehicle ID
    payload = {
        "vehicle_id": str(uuid.uuid4()),
        "liters": 10.0,
        "cost": 20.0,
        "date": str(date.today()),
    }
    response = await client.post("/fuel-logs/", headers=headers, json=payload)
    assert response.status_code == 404

    # 3. Vehicle and Trip mismatch (trip belongs to v1, but we pass v2)
    payload = {
        "vehicle_id": str(v2.id),
        "trip_id": str(trip.id),  # Belongs to v1
        "liters": 10.0,
        "cost": 20.0,
        "date": str(date.today()),
    }
    response = await client.post("/fuel-logs/", headers=headers, json=payload)
    assert response.status_code == 400
    assert "trip does not belong to the selected vehicle" in response.json()["detail"]


@pytest.mark.asyncio
async def test_fleet_manager_read_only_access(client: AsyncClient, db_session: AsyncSession):
    v1, v2, trip = await setup_fuel_expense_resources(db_session)

    # 1. Create a fuel log and expense directly in the DB
    res = await db_session.execute(select(User))
    user_id = res.scalars().first().id

    fuel_log = FuelLog(
        vehicle_id=v1.id,
        trip_id=trip.id,
        liters=40.0,
        cost=80.0,
        date=date.today(),
        created_by=user_id,
    )
    expense = Expense(
        vehicle_id=v1.id,
        trip_id=trip.id,
        expense_type="PARKING",
        amount=15.0,
        date=date.today(),
        created_by=user_id,
    )
    db_session.add_all([fuel_log, expense])
    await db_session.commit()

    # 2. Log in as Fleet Manager
    fm_headers = await create_user_with_role(db_session, client, "manager@test.com", "FLEET_MANAGER")

    # Read checks
    resp = await client.get("/fuel-logs/", headers=fm_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    resp = await client.get("/expenses/", headers=fm_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # Write checks -> should be forbidden (403)
    resp = await client.post("/fuel-logs/", headers=fm_headers, json={
        "vehicle_id": str(v1.id), "liters": 10.0, "cost": 20.0, "date": str(date.today())
    })
    assert resp.status_code == 403

    resp = await client.post("/expenses/", headers=fm_headers, json={
        "vehicle_id": str(v1.id), "expense_type": "TOLL", "amount": 10.0, "date": str(date.today())
    })
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_unauthorized_roles_blocked(client: AsyncClient, db_session: AsyncSession):
    v1, v2, trip = await setup_fuel_expense_resources(db_session)
    so_headers = await create_user_with_role(db_session, client, "safety@test.com", "SAFETY_OFFICER")

    # Safety Officer is blocked from listing fuel logs
    response = await client.get("/fuel-logs/", headers=so_headers)
    assert response.status_code == 403

    # Safety Officer is blocked from listing expenses
    response = await client.get("/expenses/", headers=so_headers)
    assert response.status_code == 403
