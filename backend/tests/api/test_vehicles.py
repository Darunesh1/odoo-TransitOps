import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Role, Vehicle, VehicleStatus
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
async def test_admin_crud_vehicle_flow(client: AsyncClient, db_session: AsyncSession):
    headers = await create_user_with_role(db_session, client, "admin@test.com", "ADMIN")

    # 1. Create Vehicle
    payload = {
        "registration_number": "TX-100",
        "name": "Heavy Duty Rig",
        "model": "Volvo FH16",
        "vehicle_type": "Truck",
        "max_load_capacity": 25000.0,
        "odometer": 150.0,
        "acquisition_cost": 85000.00,
        "region": "North",
    }
    response = await client.post("/vehicles/", headers=headers, json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["registration_number"] == "TX-100"
    assert data["status"] == "AVAILABLE"
    vehicle_uuid = data["id"]

    # 2. Read Vehicle
    response = await client.get(f"/vehicles/{vehicle_uuid}", headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Heavy Duty Rig"

    # 3. Update Vehicle
    response = await client.patch(
        f"/vehicles/{vehicle_uuid}", headers=headers, json={"name": "Super Rig"}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Super Rig"


@pytest.mark.asyncio
async def test_fleet_manager_crud_vehicle_flow(client: AsyncClient, db_session: AsyncSession):
    headers = await create_user_with_role(db_session, client, "manager@test.com", "FLEET_MANAGER")

    # 1. Create Vehicle
    payload = {
        "registration_number": "TX-200",
        "name": "Medium Flatbed",
        "model": "Ford F-750",
        "vehicle_type": "Flatbed",
        "max_load_capacity": 10000.0,
        "odometer": 5000.0,
        "acquisition_cost": 45000.00,
        "region": "South",
    }
    response = await client.post("/vehicles/", headers=headers, json=payload)
    assert response.status_code == 201
    vehicle_uuid = response.json()["id"]

    # 2. List Vehicles
    response = await client.get("/vehicles/", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1

    # 3. Update Vehicle
    response = await client.patch(
        f"/vehicles/{vehicle_uuid}", headers=headers, json={"region": "East"}
    )
    assert response.status_code == 200
    assert response.json()["region"] == "East"

    # 4. Retire Vehicle
    response = await client.post(f"/vehicles/{vehicle_uuid}/retire", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "RETIRED"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role_name",
    [
        "DISPATCHER",
        "SAFETY_OFFICER",
        "FINANCIAL_ANALYST",
    ],
)
async def test_non_authorized_roles_cannot_create_vehicle(
    client: AsyncClient, db_session: AsyncSession, role_name: str
):
    headers = await create_user_with_role(
        db_session, client, f"{role_name.lower()}@test.com", role_name
    )

    payload = {
        "registration_number": "TX-FAILED",
        "name": "Unauthorized Rig",
        "vehicle_type": "Truck",
        "max_load_capacity": 12000.0,
        "acquisition_cost": 50000.00,
    }

    response = await client.post("/vehicles/", headers=headers, json=payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"


@pytest.mark.asyncio
async def test_dispatcher_can_list_available_vehicles(client: AsyncClient, db_session: AsyncSession):
    # 1. Create a vehicle directly in the DB
    available_vehicle = Vehicle(
        registration_number="TX-AVAIL",
        name="Available Van",
        vehicle_type="Van",
        max_load_capacity=1500.0,
        odometer=20.0,
        acquisition_cost=20000.0,
        status=VehicleStatus.AVAILABLE,
    )
    db_session.add(available_vehicle)
    await db_session.commit()

    # 2. Log in as Dispatcher
    headers = await create_user_with_role(db_session, client, "dispatcher@test.com", "DISPATCHER")

    # 3. Read available vehicles list
    response = await client.get("/vehicles/available", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert all(v["status"] == "AVAILABLE" for v in data)


@pytest.mark.asyncio
async def test_unauthenticated_requests_are_rejected(client: AsyncClient):
    # Try any protected vehicle endpoint without headers
    response = await client.get("/vehicles/")
    assert response.status_code == 401

    response = await client.post("/vehicles/", json={})
    assert response.status_code == 401

    random_uuid = str(uuid.uuid4())
    response = await client.patch(f"/vehicles/{random_uuid}", json={})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_vehicle_business_validations(client: AsyncClient, db_session: AsyncSession):
    headers = await create_user_with_role(db_session, client, "manager@test.com", "FLEET_MANAGER")

    # 1. Invalid capacity (<= 0)
    payload = {
        "registration_number": "TX-ERR-1",
        "name": "Error Rig",
        "vehicle_type": "Truck",
        "max_load_capacity": 0.0,
        "acquisition_cost": 50000.0,
    }
    response = await client.post("/vehicles/", headers=headers, json=payload)
    assert response.status_code == 422

    # 2. Negative odometer
    payload = {
        "registration_number": "TX-ERR-2",
        "name": "Error Rig",
        "vehicle_type": "Truck",
        "max_load_capacity": 1000.0,
        "odometer": -10.0,
        "acquisition_cost": 50000.0,
    }
    response = await client.post("/vehicles/", headers=headers, json=payload)
    assert response.status_code == 422

    # 3. Negative acquisition cost
    payload = {
        "registration_number": "TX-ERR-3",
        "name": "Error Rig",
        "vehicle_type": "Truck",
        "max_load_capacity": 1000.0,
        "acquisition_cost": -100.00,
    }
    response = await client.post("/vehicles/", headers=headers, json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_duplicate_registration_number_conflict(client: AsyncClient, db_session: AsyncSession):
    headers = await create_user_with_role(db_session, client, "manager@test.com", "FLEET_MANAGER")

    # Register first vehicle
    payload = {
        "registration_number": "DUP-REG-99",
        "name": "Rig A",
        "vehicle_type": "Truck",
        "max_load_capacity": 5000.0,
        "acquisition_cost": 30000.0,
    }
    response = await client.post("/vehicles/", headers=headers, json=payload)
    assert response.status_code == 201

    # Register second vehicle with duplicate registration number
    payload["name"] = "Rig B"
    response = await client.post("/vehicles/", headers=headers, json=payload)
    assert response.status_code == 409
    assert response.json()["detail"] == "A vehicle with this registration number already exists."


@pytest.mark.asyncio
async def test_unknown_vehicle_id_not_found(client: AsyncClient, db_session: AsyncSession):
    headers = await create_user_with_role(db_session, client, "manager@test.com", "FLEET_MANAGER")
    random_uuid = str(uuid.uuid4())

    response = await client.get(f"/vehicles/{random_uuid}", headers=headers)
    assert response.status_code == 404

    response = await client.patch(
        f"/vehicles/{random_uuid}", headers=headers, json={"name": "New Name"}
    )
    assert response.status_code == 404

    response = await client.post(f"/vehicles/{random_uuid}/retire", headers=headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_vehicle_filtering_by_status_and_region(client: AsyncClient, db_session: AsyncSession):
    # 1. Seed two vehicles directly with different statuses and regions
    v1 = Vehicle(
        registration_number="FIL-1",
        name="Rig 1",
        vehicle_type="Flatbed",
        max_load_capacity=5000.0,
        odometer=0.0,
        acquisition_cost=10000.0,
        status=VehicleStatus.AVAILABLE,
        region="North",
    )
    v2 = Vehicle(
        registration_number="FIL-2",
        name="Rig 2",
        vehicle_type="Flatbed",
        max_load_capacity=5000.0,
        odometer=0.0,
        acquisition_cost=10000.0,
        status=VehicleStatus.IN_SHOP,
        region="South",
    )
    db_session.add_all([v1, v2])
    await db_session.commit()

    headers = await create_user_with_role(db_session, client, "manager@test.com", "FLEET_MANAGER")

    # 2. Filter by status=AVAILABLE
    response = await client.get("/vehicles/?status=AVAILABLE", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert any(v["registration_number"] == "FIL-1" for v in data)
    assert all(v["status"] == "AVAILABLE" for v in data if v["registration_number"] == "FIL-1")

    # 3. Filter by region=South
    response = await client.get("/vehicles/?region=South", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert any(v["registration_number"] == "FIL-2" for v in data)
    assert all(v["region"] == "South" for v in data if v["registration_number"] == "FIL-2")
