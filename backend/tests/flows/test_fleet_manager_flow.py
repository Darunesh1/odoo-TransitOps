import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import Role, User, Vehicle
from app.models.vehicle import VehicleStatus


async def create_fleet_manager_headers(
    db_session: AsyncSession,
    client: AsyncClient,
    email: str = "fleet-manager@test.com",
    password: str = "password123",
) -> dict[str, str]:
    result = await db_session.execute(select(Role).where(Role.name == "FLEET_MANAGER"))
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
    assert login_response.status_code == 200

    tokens = login_response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.mark.asyncio
async def test_fleet_manager_end_to_end_flow(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_fleet_manager_headers(db_session, client)

    me_response = await client.get("/users/me", headers=headers)
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "fleet-manager@test.com"

    dashboard_response = await client.get("/dashboard/kpis", headers=headers)
    assert dashboard_response.status_code == 200

    vehicle_payload = {
        "registration_number": f"FM-{uuid.uuid4().hex[:8].upper()}",
        "name": "Fleet Manager Truck",
        "model": "Volvo FH16",
        "vehicle_type": "Truck",
        "max_load_capacity": 5000.0,
        "odometer": 1200.0,
        "acquisition_cost": 45000.0,
        "region": "North",
    }

    create_vehicle_response = await client.post(
        "/vehicles/",
        headers=headers,
        json=vehicle_payload,
    )
    assert create_vehicle_response.status_code == 201
    vehicle = create_vehicle_response.json()
    vehicle_id = vehicle["id"]
    assert vehicle["status"] == "AVAILABLE"

    get_vehicle_response = await client.get(f"/vehicles/{vehicle_id}", headers=headers)
    assert get_vehicle_response.status_code == 200
    assert get_vehicle_response.json()["status"] == "AVAILABLE"

    update_vehicle_response = await client.patch(
        f"/vehicles/{vehicle_id}",
        headers=headers,
        json={
            "name": "Fleet Manager Truck Updated",
            "region": "South",
        },
    )
    assert update_vehicle_response.status_code == 200
    assert update_vehicle_response.json()["name"] == "Fleet Manager Truck Updated"
    assert update_vehicle_response.json()["region"] == "South"

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
    maintenance = maintenance_response.json()
    maintenance_id = maintenance["id"]
    assert maintenance["status"] == "ACTIVE"

    vehicle_after_maintenance = await client.get(f"/vehicles/{vehicle_id}", headers=headers)
    assert vehicle_after_maintenance.status_code == 200
    assert vehicle_after_maintenance.json()["status"] == "IN_SHOP"

    retire_during_maintenance_response = await client.post(
        f"/vehicles/{vehicle_id}/retire",
        headers=headers,
    )
    assert retire_during_maintenance_response.status_code == 400
    assert "active maintenance log" in retire_during_maintenance_response.json()["detail"]

    update_maintenance_response = await client.patch(
        f"/maintenance/{maintenance_id}",
        headers=headers,
        json={
            "description": "Routine service with brake inspection",
            "cost": 650.0,
        },
    )
    assert update_maintenance_response.status_code == 200
    assert update_maintenance_response.json()["description"] == "Routine service with brake inspection"
    assert update_maintenance_response.json()["cost"] == 650.0

    complete_maintenance_response = await client.post(
        f"/maintenance/{maintenance_id}/complete",
        headers=headers,
    )
    assert complete_maintenance_response.status_code == 200
    assert complete_maintenance_response.json()["status"] == "COMPLETED"

    vehicle_after_complete = await client.get(f"/vehicles/{vehicle_id}", headers=headers)
    assert vehicle_after_complete.status_code == 200
    assert vehicle_after_complete.json()["status"] == "AVAILABLE"

    maintenance_list_response = await client.get("/maintenance/", headers=headers)
    assert maintenance_list_response.status_code == 200
    assert any(item["id"] == maintenance_id for item in maintenance_list_response.json())

    trips_response = await client.get("/trips/", headers=headers)
    assert trips_response.status_code == 200

    fuel_logs_response = await client.get("/fuel-logs/", headers=headers)
    assert fuel_logs_response.status_code == 200

    expenses_response = await client.get("/expenses/", headers=headers)
    assert expenses_response.status_code == 200

    analytics_summary_response = await client.get("/analytics/summary", headers=headers)
    assert analytics_summary_response.status_code == 200
    summary = analytics_summary_response.json()
    assert "total_operational_cost" in summary

    analytics_export_response = await client.get("/analytics/export", headers=headers)
    assert analytics_export_response.status_code == 200
    assert analytics_export_response.headers["content-type"].startswith("text/csv")
    assert "Metric,Value" in analytics_export_response.text

    final_retire_response = await client.post(f"/vehicles/{vehicle_id}/retire", headers=headers)
    assert final_retire_response.status_code == 200
    assert final_retire_response.json()["status"] == "RETIRED"

    final_vehicle_response = await client.get(f"/vehicles/{vehicle_id}", headers=headers)
    assert final_vehicle_response.status_code == 200
    assert final_vehicle_response.json()["status"] == "RETIRED"
