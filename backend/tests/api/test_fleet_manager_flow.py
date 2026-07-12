import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import Role, User


async def create_fleet_manager_headers(
    db_session: AsyncSession,
    client: AsyncClient,
    email: str = "fleet@test.com",
    password: str = "password123",
) -> dict:
    result = await db_session.execute(
        select(Role).where(Role.name == "FLEET_MANAGER")
    )
    role = result.scalar_one()

    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name="Fleet Manager",
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
    tokens = login_response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.mark.asyncio
async def test_fleet_manager_end_to_end_flow(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_fleet_manager_headers(db_session, client)

    vehicle_payload = {
        "registration_number": f"FM-{uuid.uuid4().hex[:8].upper()}",
        "name": "Fleet Manager Truck",
        "vehicle_type": "Truck",
        "max_load_capacity": 5000.0,
        "odometer": 1200.0,
        "acquisition_cost": 45000.0,
        "region": "North",
    }

    create_response = await client.post("/vehicles/", headers=headers, json=vehicle_payload)
    assert create_response.status_code == 201
    vehicle_id = create_response.json()["id"]

    vehicle_response = await client.get(f"/vehicles/{vehicle_id}", headers=headers)
    assert vehicle_response.status_code == 200
    assert vehicle_response.json()["status"] == "AVAILABLE"

    update_response = await client.patch(
        f"/vehicles/{vehicle_id}",
        headers=headers,
        json={"name": "Fleet Manager Truck Updated"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Fleet Manager Truck Updated"

    list_response = await client.get("/vehicles/", headers=headers)
    assert list_response.status_code == 200
    assert any(item["id"] == vehicle_id for item in list_response.json())

    maintenance_response = await client.post(
        "/maintenance/",
        headers=headers,
        json={
            "vehicle_id": vehicle_id,
            "maintenance_type": "Oil Change",
            "description": "Routine service",
            "cost": 500.0,
            "started_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert maintenance_response.status_code == 201
    maintenance_id = maintenance_response.json()["id"]
    assert maintenance_response.json()["status"] == "ACTIVE"

    vehicle_response = await client.get(f"/vehicles/{vehicle_id}", headers=headers)
    assert vehicle_response.status_code == 200
    assert vehicle_response.json()["status"] == "IN_SHOP"

    maintenance_complete_response = await client.post(
        f"/maintenance/{maintenance_id}/complete",
        headers=headers,
    )
    assert maintenance_complete_response.status_code == 200
    assert maintenance_complete_response.json()["status"] == "COMPLETED"

    vehicle_response = await client.get(f"/vehicles/{vehicle_id}", headers=headers)
    assert vehicle_response.status_code == 200
    assert vehicle_response.json()["status"] == "AVAILABLE"

    dashboard_response = await client.get("/dashboard/kpis", headers=headers)
    assert dashboard_response.status_code == 200

    analytics_response = await client.get("/analytics/summary", headers=headers)
    assert analytics_response.status_code == 200

    analytics_export_response = await client.get("/analytics/export", headers=headers)
    assert analytics_export_response.status_code == 200
    assert analytics_export_response.headers["content-type"].startswith("text/csv")

    trips_response = await client.get("/trips/", headers=headers)
    assert trips_response.status_code == 200

    fuel_logs_response = await client.get("/fuel-logs/", headers=headers)
    assert fuel_logs_response.status_code == 200

    expenses_response = await client.get("/expenses/", headers=headers)
    assert expenses_response.status_code == 200

    retire_response = await client.post(f"/vehicles/{vehicle_id}/retire", headers=headers)
    assert retire_response.status_code == 200
    assert retire_response.json()["status"] == "RETIRED"
