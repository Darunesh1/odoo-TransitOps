from datetime import date, timedelta
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import Driver, Role, User
from app.models.driver import DriverStatus


async def create_safety_officer_headers(
    db_session: AsyncSession,
    client: AsyncClient,
    email: str = "safety-officer@test.com",
    password: str = "password123",
) -> dict[str, str]:
    result = await db_session.execute(select(Role).where(Role.name == "SAFETY_OFFICER"))
    role = result.scalar_one()

    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name="Safety Officer",
        roles=[role],
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()

    login_response = await client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )
    assert login_response.status_code == 200

    tokens = login_response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def seed_driver(db_session: AsyncSession) -> tuple[Driver, Driver]:
    active_driver = Driver(
        name="Safety Driver",
        license_number=f"LIC-SAFE-{uuid.uuid4().hex[:8].upper()}",
        license_category="Class A",
        license_expiry_date=date.today() + timedelta(days=365),
        status=DriverStatus.AVAILABLE,
    )
    expired_driver = Driver(
        name="Expired Safety Driver",
        license_number=f"LIC-EXP-{uuid.uuid4().hex[:8].upper()}",
        license_category="Class B",
        license_expiry_date=date.today() - timedelta(days=1),
        status=DriverStatus.AVAILABLE,
    )

    db_session.add_all([active_driver, expired_driver])
    await db_session.commit()

    return active_driver, expired_driver


@pytest.mark.asyncio
async def test_safety_officer_end_to_end_flow(
    client: AsyncClient,
    db_session: AsyncSession,
):
    active_driver, expired_driver = await seed_driver(db_session)
    headers = await create_safety_officer_headers(db_session, client)

    dashboard_response = await client.get("/dashboard/kpis", headers=headers)
    assert dashboard_response.status_code == 200

    create_response = await client.post(
        "/drivers/",
        headers=headers,
        json={
            "name": "Safety Officer Driver",
            "license_number": f"LIC-NEW-{uuid.uuid4().hex[:8].upper()}",
            "license_category": "Class A CDL",
            "license_expiry_date": str(date.today() + timedelta(days=400)),
            "contact_number": "+1-555-0101",
            "safety_score": 97.5,
        },
    )
    assert create_response.status_code == 201
    driver = create_response.json()
    driver_id = driver["id"]
    assert driver["status"] == "AVAILABLE"

    get_driver_response = await client.get(f"/drivers/{driver_id}", headers=headers)
    assert get_driver_response.status_code == 200
    assert get_driver_response.json()["license_number"].startswith("LIC-NEW-")

    update_response = await client.patch(
        f"/drivers/{driver_id}",
        headers=headers,
        json={
            "safety_score": 93.0,
            "contact_number": "+1-555-0202",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["safety_score"] == 93.0
    assert update_response.json()["contact_number"] == "+1-555-0202"

    filtered_response = await client.get(
        "/drivers/?search=Safety Officer Driver&status=AVAILABLE&expired=false",
        headers=headers,
    )
    assert filtered_response.status_code == 200
    assert any(item["id"] == driver_id for item in filtered_response.json())

    expired_response = await client.get(
        "/drivers/?expired=true&search=Expired Safety Driver",
        headers=headers,
    )
    assert expired_response.status_code == 200
    assert any(item["id"] == str(expired_driver.id) for item in expired_response.json())

    available_pool_response = await client.get(
        "/drivers/?status=AVAILABLE&expired=false",
        headers=headers,
    )
    assert available_pool_response.status_code == 200
    assert any(item["id"] == driver_id for item in available_pool_response.json())

    suspend_response = await client.post(f"/drivers/{driver_id}/suspend", headers=headers)
    assert suspend_response.status_code == 200
    assert suspend_response.json()["status"] == "SUSPENDED"

    suspended_driver_response = await client.get(f"/drivers/{driver_id}", headers=headers)
    assert suspended_driver_response.status_code == 200
    assert suspended_driver_response.json()["status"] == "SUSPENDED"

    available_pool_response = await client.get(
        "/drivers/?status=AVAILABLE&expired=false",
        headers=headers,
    )
    assert available_pool_response.status_code == 200
    assert all(item["id"] != driver_id for item in available_pool_response.json())

    activate_response = await client.post(f"/drivers/{driver_id}/activate", headers=headers)
    assert activate_response.status_code == 200
    assert activate_response.json()["status"] == "AVAILABLE"

    reactivated_driver_response = await client.get(f"/drivers/{driver_id}", headers=headers)
    assert reactivated_driver_response.status_code == 200
    assert reactivated_driver_response.json()["status"] == "AVAILABLE"

    available_pool_response = await client.get(
        "/drivers/?status=AVAILABLE&expired=false",
        headers=headers,
    )
    assert available_pool_response.status_code == 200
    assert any(item["id"] == driver_id for item in available_pool_response.json())

    trips_response = await client.get("/trips/", headers=headers)
    assert trips_response.status_code == 200

    dispatcher_available_response = await client.get("/drivers/available", headers=headers)
    assert dispatcher_available_response.status_code == 403
