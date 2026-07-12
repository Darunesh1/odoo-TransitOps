from datetime import datetime, timezone
import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Role, Vehicle, MaintenanceLog, MaintenanceStatus
from app.models.vehicle import VehicleStatus
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


async def setup_vehicle(db_session: AsyncSession, status: VehicleStatus = VehicleStatus.AVAILABLE) -> Vehicle:
    """Helper to seed a vehicle with a specific status."""
    vehicle = Vehicle(
        registration_number=f"MAINT-VEH-{uuid.uuid4().hex[:6]}",
        name="Test Cargo Van",
        vehicle_type="Van",
        max_load_capacity=1500.0,
        odometer=200.0,
        acquisition_cost=18000.00,
        status=status,
    )
    db_session.add(vehicle)
    await db_session.commit()
    return vehicle


@pytest.mark.asyncio
async def test_fleet_manager_core_maintenance_lifecycle(client: AsyncClient, db_session: AsyncSession):
    vehicle = await setup_vehicle(db_session)
    headers = await create_user_with_role(db_session, client, "manager@test.com", "FLEET_MANAGER")

    # 1. Create Maintenance Log (ACTIVE status)
    payload = {
        "vehicle_id": str(vehicle.id),
        "maintenance_type": "Engine Tune-up",
        "description": "Routine spark plug replacement and fluid check.",
        "cost": 350.00,
    }
    response = await client.post("/maintenance/", headers=headers, json=payload)
    assert response.status_code == 201
    log_data = response.json()
    assert log_data["status"] == "ACTIVE"
    assert log_data["cost"] == 350.00
    log_uuid = log_data["id"]

    # Verify vehicle status is updated to IN_SHOP
    await db_session.refresh(vehicle)
    assert vehicle.status == VehicleStatus.IN_SHOP

    # 2. Update Maintenance Log
    response = await client.patch(
        f"/maintenance/{log_uuid}", headers=headers, json={"cost": 400.00}
    )
    assert response.status_code == 200
    assert response.json()["cost"] == 400.00

    # 3. Complete Maintenance
    response = await client.post(f"/maintenance/{log_uuid}/complete", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "COMPLETED"

    # Verify vehicle returns to AVAILABLE
    await db_session.refresh(vehicle)
    assert vehicle.status == VehicleStatus.AVAILABLE


@pytest.mark.asyncio
async def test_maintenance_creation_validations(client: AsyncClient, db_session: AsyncSession):
    headers = await create_user_with_role(db_session, client, "manager@test.com", "FLEET_MANAGER")

    # 1. Reject ON_TRIP vehicle
    v_trip = await setup_vehicle(db_session, VehicleStatus.ON_TRIP)
    payload = {
        "vehicle_id": str(v_trip.id),
        "maintenance_type": "Tire Swap",
        "cost": 100.0,
    }
    response = await client.post("/maintenance/", headers=headers, json=payload)
    assert response.status_code == 400
    assert "while it is actively on a trip" in response.json()["detail"]

    # 2. Reject RETIRED vehicle
    v_retired = await setup_vehicle(db_session, VehicleStatus.RETIRED)
    payload["vehicle_id"] = str(v_retired.id)
    response = await client.post("/maintenance/", headers=headers, json=payload)
    assert response.status_code == 400
    assert "Cannot place a retired vehicle in maintenance" in response.json()["detail"]

    # 3. Reject duplicate active maintenance (IN_SHOP vehicle)
    v_shop = await setup_vehicle(db_session, VehicleStatus.IN_SHOP)
    payload["vehicle_id"] = str(v_shop.id)
    response = await client.post("/maintenance/", headers=headers, json=payload)
    assert response.status_code == 400
    assert "already has an active maintenance record" in response.json()["detail"]


@pytest.mark.asyncio
async def test_maintenance_cancellation_flow(client: AsyncClient, db_session: AsyncSession):
    vehicle = await setup_vehicle(db_session)
    headers = await create_user_with_role(db_session, client, "manager@test.com", "FLEET_MANAGER")

    # Create active log
    payload = {"vehicle_id": str(vehicle.id), "maintenance_type": "Oil Change", "cost": 50.0}
    response = await client.post("/maintenance/", headers=headers, json=payload)
    log_uuid = response.json()["id"]

    # Cancel maintenance
    response = await client.post(f"/maintenance/{log_uuid}/cancel", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "CANCELLED"

    # Verify vehicle status returns to AVAILABLE
    await db_session.refresh(vehicle)
    assert vehicle.status == VehicleStatus.AVAILABLE


@pytest.mark.asyncio
async def test_cannot_retire_vehicle_with_active_maintenance(client: AsyncClient, db_session: AsyncSession):
    vehicle = await setup_vehicle(db_session)
    headers_fm = await create_user_with_role(db_session, client, "manager@test.com", "FLEET_MANAGER")

    # Create active maintenance log
    payload = {"vehicle_id": str(vehicle.id), "maintenance_type": "Brake Replacement", "cost": 500.0}
    response = await client.post("/maintenance/", headers=headers_fm, json=payload)
    assert response.status_code == 201

    # Attempt to retire vehicle while maintenance is active -> should fail (400)
    response = await client.post(f"/vehicles/{vehicle.id}/retire", headers=headers_fm)
    assert response.status_code == 400
    assert "Cannot retire a vehicle while it has an active maintenance log" in response.json()["detail"]


@pytest.mark.asyncio
async def test_financial_analyst_permissions_and_unauthorized_roles(client: AsyncClient, db_session: AsyncSession):
    # 1. Log in as Financial Analyst (this registers them in the DB)
    fa_headers = await create_user_with_role(db_session, client, "analyst@test.com", "FINANCIAL_ANALYST")

    # Retrieve the registered analyst user object
    user_query = select(User).where(User.email == "analyst@test.com")
    user_res = await db_session.execute(user_query)
    analyst_user = user_res.scalar_one()

    vehicle = await setup_vehicle(db_session)

    # 2. Create a log directly in the DB
    log = MaintenanceLog(
        vehicle_id=vehicle.id,
        maintenance_type="Transmission Repair",
        cost=1200.00,
        status=MaintenanceStatus.ACTIVE,
        started_at=datetime.now(timezone.utc),
        created_by=analyst_user.id,
    )
    db_session.add(log)
    await db_session.commit()

    # Analyst can view logs
    response = await client.get("/maintenance/", headers=fa_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1

    # Analyst CANNOT modify/complete logs
    response = await client.post(f"/maintenance/{log.id}/complete", headers=fa_headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"

    # 3. Log in as Dispatcher (Unauthorized role)
    disp_headers = await create_user_with_role(db_session, client, "disp@test.com", "DISPATCHER")

    # Dispatcher cannot even read logs
    response = await client.get("/maintenance/", headers=disp_headers)
    assert response.status_code == 403
