from datetime import date, timedelta
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import Driver, Role, User, Vehicle
from app.models.driver import DriverStatus
from app.models.vehicle import VehicleStatus


async def create_dispatcher_headers(
    db_session: AsyncSession,
    client: AsyncClient,
    email: str = "dispatcher@test.com",
    password: str = "password123",
) -> dict[str, str]:
    result = await db_session.execute(select(Role).where(Role.name == "DISPATCHER"))
    role = result.scalar_one()

    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name="Dispatcher",
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


async def seed_dispatcher_resources(db_session: AsyncSession) -> tuple[Vehicle, Driver, Vehicle, Driver]:
    available_vehicle = Vehicle(
        registration_number=f"DISP-VEH-{uuid.uuid4().hex[:8].upper()}",
        name="Dispatcher Truck",
        vehicle_type="Truck",
        max_load_capacity=5000.0,
        odometer=100.0,
        acquisition_cost=50000.0,
        status=VehicleStatus.AVAILABLE,
    )
    blocked_vehicle = Vehicle(
        registration_number=f"DISP-BLOCK-{uuid.uuid4().hex[:8].upper()}",
        name="Blocked Van",
        vehicle_type="Van",
        max_load_capacity=2000.0,
        odometer=50.0,
        acquisition_cost=25000.0,
        status=VehicleStatus.IN_SHOP,
    )
    available_driver = Driver(
        name="Dispatcher Driver",
        license_number=f"LIC-DISP-{uuid.uuid4().hex[:8].upper()}",
        license_category="Class A",
        license_expiry_date=date.today() + timedelta(days=365),
        status=DriverStatus.AVAILABLE,
    )
    blocked_driver = Driver(
        name="Blocked Driver",
        license_number=f"LIC-BLOCK-{uuid.uuid4().hex[:8].upper()}",
        license_category="Class B",
        license_expiry_date=date.today() - timedelta(days=1),
        status=DriverStatus.AVAILABLE,
    )

    db_session.add_all([available_vehicle, blocked_vehicle, available_driver, blocked_driver])
    await db_session.commit()

    return available_vehicle, available_driver, blocked_vehicle, blocked_driver


@pytest.mark.asyncio
async def test_dispatcher_end_to_end_flow(
    client: AsyncClient,
    db_session: AsyncSession,
):
    vehicle, driver, blocked_vehicle, blocked_driver = await seed_dispatcher_resources(db_session)
    headers = await create_dispatcher_headers(db_session, client)

    dashboard_response = await client.get("/dashboard/kpis", headers=headers)
    assert dashboard_response.status_code == 200

    available_vehicles_response = await client.get("/vehicles/available", headers=headers)
    assert available_vehicles_response.status_code == 200
    available_vehicle_ids = {item["id"] for item in available_vehicles_response.json()}
    assert str(vehicle.id) in available_vehicle_ids
    assert str(blocked_vehicle.id) not in available_vehicle_ids

    available_drivers_response = await client.get("/drivers/available", headers=headers)
    assert available_drivers_response.status_code == 200
    available_driver_ids = {item["id"] for item in available_drivers_response.json()}
    assert str(driver.id) in available_driver_ids
    assert str(blocked_driver.id) not in available_driver_ids

    trip_payload = {
        "source": "Warehouse A",
        "destination": "Retail Outlet B",
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "cargo_weight": 1500.0,
        "planned_distance": 50.0,
        "revenue": 500.0,
    }
    create_trip_response = await client.post("/trips/", headers=headers, json=trip_payload)
    assert create_trip_response.status_code == 201
    trip = create_trip_response.json()
    trip_id = trip["id"]
    assert trip["status"] == "DRAFT"

    update_trip_response = await client.patch(
        f"/trips/{trip_id}",
        headers=headers,
        json={
            "destination": "Retail Outlet C",
            "cargo_weight": 1400.0,
        },
    )
    assert update_trip_response.status_code == 200
    assert update_trip_response.json()["destination"] == "Retail Outlet C"
    assert update_trip_response.json()["cargo_weight"] == 1400.0

    dispatch_response = await client.post(f"/trips/{trip_id}/dispatch", headers=headers)
    assert dispatch_response.status_code == 200
    dispatch_trip = dispatch_response.json()
    assert dispatch_trip["status"] == "DISPATCHED"
    assert dispatch_trip["start_odometer"] == 100.0

    vehicle_after_dispatch = await client.get(f"/vehicles/{vehicle.id}", headers=headers)
    assert vehicle_after_dispatch.status_code == 200
    assert vehicle_after_dispatch.json()["status"] == "ON_TRIP"

    driver_after_dispatch = await client.get(f"/drivers/{driver.id}", headers=headers)
    assert driver_after_dispatch.status_code == 200
    assert driver_after_dispatch.json()["status"] == "ON_TRIP"

    available_vehicles_response = await client.get("/vehicles/available", headers=headers)
    assert available_vehicles_response.status_code == 200
    assert all(item["id"] != str(vehicle.id) for item in available_vehicles_response.json())

    available_drivers_response = await client.get("/drivers/available", headers=headers)
    assert available_drivers_response.status_code == 200
    assert all(item["id"] != str(driver.id) for item in available_drivers_response.json())

    blocked_trip_response = await client.post(
        "/trips/",
        headers=headers,
        json={
            "source": "Warehouse A",
            "destination": "Retail Outlet D",
            "vehicle_id": str(vehicle.id),
            "driver_id": str(driver.id),
            "cargo_weight": 1000.0,
            "planned_distance": 30.0,
            "revenue": 250.0,
        },
    )
    assert blocked_trip_response.status_code == 201
    blocked_trip_id = blocked_trip_response.json()["id"]

    blocked_dispatch_response = await client.post(
        f"/trips/{blocked_trip_id}/dispatch",
        headers=headers,
    )
    assert blocked_dispatch_response.status_code == 400
    assert "not available" in blocked_dispatch_response.json()["detail"]

    complete_response = await client.post(
        f"/trips/{trip_id}/complete",
        headers=headers,
        json={
            "final_odometer": 165.0,
            "fuel_consumed": 12.5,
        },
    )
    assert complete_response.status_code == 200
    assert complete_response.json()["status"] == "COMPLETED"

    vehicle_after_complete = await client.get(f"/vehicles/{vehicle.id}", headers=headers)
    assert vehicle_after_complete.status_code == 200
    assert vehicle_after_complete.json()["status"] == "AVAILABLE"

    driver_after_complete = await client.get(f"/drivers/{driver.id}", headers=headers)
    assert driver_after_complete.status_code == 200
    assert driver_after_complete.json()["status"] == "AVAILABLE"

    available_vehicles_response = await client.get("/vehicles/available", headers=headers)
    assert available_vehicles_response.status_code == 200
    assert any(item["id"] == str(vehicle.id) for item in available_vehicles_response.json())

    available_drivers_response = await client.get("/drivers/available", headers=headers)
    assert available_drivers_response.status_code == 200
    assert any(item["id"] == str(driver.id) for item in available_drivers_response.json())

    cancelled_vehicle = Vehicle(
        registration_number=f"DISP-CANCEL-{uuid.uuid4().hex[:8].upper()}",
        name="Cancel Truck",
        vehicle_type="Truck",
        max_load_capacity=4000.0,
        odometer=300.0,
        acquisition_cost=42000.0,
        status=VehicleStatus.AVAILABLE,
    )
    cancelled_driver = Driver(
        name="Cancel Driver",
        license_number=f"LIC-CANCEL-{uuid.uuid4().hex[:8].upper()}",
        license_category="Class B",
        license_expiry_date=date.today() + timedelta(days=200),
        status=DriverStatus.AVAILABLE,
    )
    db_session.add_all([cancelled_vehicle, cancelled_driver])
    await db_session.commit()

    cancel_trip_response = await client.post(
        "/trips/",
        headers=headers,
        json={
            "source": "Depot",
            "destination": "Client Site",
            "vehicle_id": str(cancelled_vehicle.id),
            "driver_id": str(cancelled_driver.id),
            "cargo_weight": 500.0,
            "planned_distance": 20.0,
            "revenue": 150.0,
        },
    )
    assert cancel_trip_response.status_code == 201
    cancel_trip_id = cancel_trip_response.json()["id"]

    cancel_dispatch_response = await client.post(
        f"/trips/{cancel_trip_id}/dispatch",
        headers=headers,
    )
    assert cancel_dispatch_response.status_code == 200
    assert cancel_dispatch_response.json()["status"] == "DISPATCHED"

    trip_cancel_response = await client.post(f"/trips/{cancel_trip_id}/cancel", headers=headers)
    assert trip_cancel_response.status_code == 200
    assert trip_cancel_response.json()["status"] == "CANCELLED"

    cancelled_vehicle_response = await client.get(f"/vehicles/{cancelled_vehicle.id}", headers=headers)
    assert cancelled_vehicle_response.status_code == 200
    assert cancelled_vehicle_response.json()["status"] == "AVAILABLE"

    cancelled_driver_response = await client.get(f"/drivers/{cancelled_driver.id}", headers=headers)
    assert cancelled_driver_response.status_code == 200
    assert cancelled_driver_response.json()["status"] == "AVAILABLE"
