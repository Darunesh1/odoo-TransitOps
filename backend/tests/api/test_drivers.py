from datetime import date, timedelta
import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Role, Driver, DriverStatus
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
async def test_safety_officer_crud_driver_flow(client: AsyncClient, db_session: AsyncSession):
    headers = await create_user_with_role(db_session, client, "safety@test.com", "SAFETY_OFFICER")

    # 1. Create Driver
    payload = {
        "name": "Jane Doe",
        "license_number": "LIC-SO-123",
        "license_category": "Class A CDL",
        "license_expiry_date": str(date.today() + timedelta(days=365)),
        "contact_number": "+1-555-0199",
        "safety_score": 98.50,
    }
    response = await client.post("/drivers/", headers=headers, json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Jane Doe"
    assert data["status"] == "AVAILABLE"
    driver_uuid = data["id"]

    # 2. Read Driver
    response = await client.get(f"/drivers/{driver_uuid}", headers=headers)
    assert response.status_code == 200
    assert response.json()["license_number"] == "LIC-SO-123"

    # 3. Update Driver
    response = await client.patch(
        f"/drivers/{driver_uuid}", headers=headers, json={"safety_score": 95.00}
    )
    assert response.status_code == 200
    assert response.json()["safety_score"] == 95.00

    # 4. Suspend Driver
    response = await client.post(f"/drivers/{driver_uuid}/suspend", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "SUSPENDED"

    # 5. Activate Driver
    response = await client.post(f"/drivers/{driver_uuid}/activate", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "AVAILABLE"


@pytest.mark.asyncio
async def test_dispatcher_read_driver_permissions(client: AsyncClient, db_session: AsyncSession):
    # 1. Create a driver directly
    driver = Driver(
        name="Alex Driver",
        license_number="LIC-DISP-88",
        license_category="Class B CDL",
        license_expiry_date=date.today() + timedelta(days=200),
        status=DriverStatus.AVAILABLE,
    )
    db_session.add(driver)
    await db_session.commit()

    # 2. Log in as Dispatcher
    headers = await create_user_with_role(db_session, client, "dispatcher@test.com", "DISPATCHER")

    # Dispatcher can list drivers
    response = await client.get("/drivers/", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1

    # Dispatcher can read single driver
    response = await client.get(f"/drivers/{driver.id}", headers=headers)
    assert response.status_code == 200

    # Dispatcher CANNOT create drivers
    payload = {
        "name": "Unauthorized Driver",
        "license_number": "LIC-FAILED",
        "license_category": "Class C",
        "license_expiry_date": str(date.today() + timedelta(days=365)),
    }
    response = await client.post("/drivers/", headers=headers, json=payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role_name",
    [
        "FLEET_MANAGER",
        "FINANCIAL_ANALYST",
    ],
)
async def test_unauthorized_roles_cannot_write_drivers(
    client: AsyncClient, db_session: AsyncSession, role_name: str
):
    headers = await create_user_with_role(
        db_session, client, f"{role_name.lower()}@test.com", role_name
    )

    payload = {
        "name": "Blocked Driver",
        "license_number": "LIC-BLOCKED",
        "license_category": "Class C",
        "license_expiry_date": str(date.today() + timedelta(days=100)),
    }

    # Cannot create
    response = await client.post("/drivers/", headers=headers, json=payload)
    assert response.status_code == 403

    random_uuid = str(uuid.uuid4())
    # Cannot suspend
    response = await client.post(f"/drivers/{random_uuid}/suspend", headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_bypasses_all_driver_restrictions(client: AsyncClient, db_session: AsyncSession):
    headers = await create_user_with_role(db_session, client, "admin@test.com", "ADMIN")

    payload = {
        "name": "Admin Seeding Driver",
        "license_number": "LIC-ADMIN-777",
        "license_category": "Class A",
        "license_expiry_date": str(date.today() + timedelta(days=500)),
        "safety_score": 100.0,
    }

    # Admin can create driver
    response = await client.post("/drivers/", headers=headers, json=payload)
    assert response.status_code == 201
    driver_uuid = response.json()["id"]

    # Admin can suspend
    response = await client.post(f"/drivers/{driver_uuid}/suspend", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "SUSPENDED"


@pytest.mark.asyncio
async def test_unauthenticated_driver_requests_are_rejected(client: AsyncClient):
    response = await client.get("/drivers/")
    assert response.status_code == 401

    response = await client.post("/drivers/", json={})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_driver_business_validations(client: AsyncClient, db_session: AsyncSession):
    headers = await create_user_with_role(db_session, client, "safety@test.com", "SAFETY_OFFICER")

    # 1. Invalid safety score (> 100)
    payload = {
        "name": "Jane Doe",
        "license_number": "LIC-ERR-1",
        "license_category": "Class A",
        "license_expiry_date": str(date.today() + timedelta(days=100)),
        "safety_score": 105.00,
    }
    response = await client.post("/drivers/", headers=headers, json=payload)
    assert response.status_code == 422

    # 2. Invalid safety score (< 0)
    payload["safety_score"] = -5.0
    response = await client.post("/drivers/", headers=headers, json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_duplicate_license_number_conflict(client: AsyncClient, db_session: AsyncSession):
    headers = await create_user_with_role(db_session, client, "safety@test.com", "SAFETY_OFFICER")

    payload = {
        "name": "Driver A",
        "license_number": "DUP-LIC-NUMBER",
        "license_category": "Class A",
        "license_expiry_date": str(date.today() + timedelta(days=200)),
    }
    response = await client.post("/drivers/", headers=headers, json=payload)
    assert response.status_code == 201

    payload["name"] = "Driver B"
    response = await client.post("/drivers/", headers=headers, json=payload)
    assert response.status_code == 409
    assert response.json()["detail"] == "A driver with this license number already exists."


@pytest.mark.asyncio
async def test_unknown_driver_id_not_found(client: AsyncClient, db_session: AsyncSession):
    headers = await create_user_with_role(db_session, client, "safety@test.com", "SAFETY_OFFICER")
    random_uuid = str(uuid.uuid4())

    response = await client.get(f"/drivers/{random_uuid}", headers=headers)
    assert response.status_code == 404

    response = await client.patch(
        f"/drivers/{random_uuid}", headers=headers, json={"name": "New Name"}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_available_drivers_endpoint_filtering(client: AsyncClient, db_session: AsyncSession):
    # Seed 4 drivers:
    # 1. Valid and AVAILABLE
    d1 = Driver(
        name="Valid Avail",
        license_number="LIC-VAL-AVAIL",
        license_category="Class A",
        license_expiry_date=date.today() + timedelta(days=5),
        status=DriverStatus.AVAILABLE,
    )
    # 2. Expired but AVAILABLE
    d2 = Driver(
        name="Expired Avail",
        license_number="LIC-EXP-AVAIL",
        license_category="Class A",
        license_expiry_date=date.today() - timedelta(days=5),
        status=DriverStatus.AVAILABLE,
    )
    # 3. Valid but SUSPENDED
    d3 = Driver(
        name="Valid Suspended",
        license_number="LIC-VAL-SUSP",
        license_category="Class A",
        license_expiry_date=date.today() + timedelta(days=10),
        status=DriverStatus.SUSPENDED,
    )
    # 4. Valid but ON_TRIP
    d4 = Driver(
        name="Valid On Trip",
        license_number="LIC-VAL-TRIP",
        license_category="Class A",
        license_expiry_date=date.today() + timedelta(days=15),
        status=DriverStatus.ON_TRIP,
    )
    db_session.add_all([d1, d2, d3, d4])
    await db_session.commit()

    # Log in as Dispatcher
    headers = await create_user_with_role(db_session, client, "dispatcher@test.com", "DISPATCHER")

    response = await client.get("/drivers/available", headers=headers)
    assert response.status_code == 200
    data = response.json()

    # Should only return the first driver (Valid Avail)
    assert any(d["license_number"] == "LIC-VAL-AVAIL" for d in data)
    assert not any(d["license_number"] == "LIC-EXP-AVAIL" for d in data)
    assert not any(d["license_number"] == "LIC-VAL-SUSP" for d in data)
    assert not any(d["license_number"] == "LIC-VAL-TRIP" for d in data)
