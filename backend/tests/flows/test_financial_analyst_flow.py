from datetime import date, datetime, timedelta, timezone
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import Driver, Role, Trip, User, Vehicle
from app.models.driver import DriverStatus
from app.models.expense import Expense
from app.models.fuel_log import FuelLog
from app.models.maintenance_log import MaintenanceLog, MaintenanceStatus
from app.models.trip import TripStatus
from app.models.vehicle import VehicleStatus


async def create_financial_analyst_headers(
    db_session: AsyncSession,
    client: AsyncClient,
    email: str = "financial-analyst@test.com",
    password: str = "password123",
) -> dict[str, str]:
    result = await db_session.execute(select(Role).where(Role.name == "FINANCIAL_ANALYST"))
    role = result.scalar_one()

    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name="Financial Analyst",
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


async def seed_financial_analyst_resources(db_session: AsyncSession) -> tuple[Vehicle, Trip, User, MaintenanceLog]:
    analyst_result = await db_session.execute(
        select(Role).where(Role.name == "FINANCIAL_ANALYST")
    )
    analyst_role = analyst_result.scalar_one()

    creator = User(
        email=f"creator-{uuid.uuid4().hex[:8]}@test.com",
        hashed_password=hash_password("password123"),
        full_name="Trip Creator",
        roles=[analyst_role],
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )

    vehicle = Vehicle(
        registration_number=f"FA-VEH-{uuid.uuid4().hex[:8].upper()}",
        name="Finance Truck",
        vehicle_type="Truck",
        max_load_capacity=5000.0,
        odometer=1000.0,
        acquisition_cost=20000.0,
        status=VehicleStatus.AVAILABLE,
        region="North",
    )

    driver = Driver(
        name="Finance Driver",
        license_number=f"LIC-FA-{uuid.uuid4().hex[:8].upper()}",
        license_category="Class A",
        license_expiry_date=date.today() + timedelta(days=365),
        status=DriverStatus.AVAILABLE,
    )

    db_session.add_all([creator, vehicle, driver])
    await db_session.commit()

    trip = Trip(
        trip_number=f"TRIP-FA-{uuid.uuid4().hex[:8].upper()}",
        source="Depot",
        destination="Client Site",
        vehicle_id=vehicle.id,
        driver_id=driver.id,
        cargo_weight=1200.0,
        planned_distance=350.0,
        start_odometer=1000.0,
        final_odometer=1350.0,
        fuel_consumed=35.0,
        revenue=1200.0,
        status=TripStatus.COMPLETED,
        completed_at=datetime.now(timezone.utc),
        created_by=creator.id,
    )

    maintenance = MaintenanceLog(
        vehicle_id=vehicle.id,
        maintenance_type="Brake Service",
        description="Completed scheduled brake service",
        cost=300.0,
        status=MaintenanceStatus.COMPLETED,
        started_at=datetime.now(timezone.utc) - timedelta(days=2),
        completed_at=datetime.now(timezone.utc),
        created_by=creator.id,
    )

    db_session.add_all([trip, maintenance])
    await db_session.commit()

    return vehicle, trip, creator, maintenance


@pytest.mark.asyncio
async def test_financial_analyst_end_to_end_flow(
    client: AsyncClient,
    db_session: AsyncSession,
):
    vehicle, trip, creator, maintenance = await seed_financial_analyst_resources(db_session)
    headers = await create_financial_analyst_headers(db_session, client)
    today = date.today()

    dashboard_response = await client.get("/dashboard/kpis", headers=headers)
    assert dashboard_response.status_code == 200

    vehicles_response = await client.get("/vehicles/", headers=headers)
    assert vehicles_response.status_code == 200
    assert any(item["id"] == str(vehicle.id) for item in vehicles_response.json())

    vehicle_detail_response = await client.get(f"/vehicles/{vehicle.id}", headers=headers)
    assert vehicle_detail_response.status_code == 200
    assert vehicle_detail_response.json()["status"] == "AVAILABLE"

    trips_response = await client.get("/trips/", headers=headers)
    assert trips_response.status_code == 200
    assert any(item["id"] == str(trip.id) for item in trips_response.json())

    trip_detail_response = await client.get(f"/trips/{trip.id}", headers=headers)
    assert trip_detail_response.status_code == 200
    assert trip_detail_response.json()["status"] == "COMPLETED"

    maintenance_response = await client.get("/maintenance/", headers=headers)
    assert maintenance_response.status_code == 200
    assert any(item["id"] == str(maintenance.id) for item in maintenance_response.json())

    maintenance_detail_response = await client.get(f"/maintenance/{maintenance.id}", headers=headers)
    assert maintenance_detail_response.status_code == 200
    assert maintenance_detail_response.json()["status"] == "COMPLETED"

    fuel_create_response = await client.post(
        "/fuel-logs/",
        headers=headers,
        json={
            "vehicle_id": str(vehicle.id),
            "trip_id": str(trip.id),
            "liters": 14.0,
            "cost": 110.0,
            "date": str(today),
            "odometer": 1340.0,
        },
    )
    assert fuel_create_response.status_code == 201
    fuel_log = fuel_create_response.json()
    fuel_log_id = fuel_log["id"]
    assert fuel_log["cost"] == 110.0

    expense_create_response = await client.post(
        "/expenses/",
        headers=headers,
        json={
            "vehicle_id": str(vehicle.id),
            "trip_id": str(trip.id),
            "expense_type": "TOLL",
            "description": "Expressway toll",
            "amount": 55.0,
            "date": str(today),
        },
    )
    assert expense_create_response.status_code == 201
    expense = expense_create_response.json()
    expense_id = expense["id"]
    assert expense["amount"] == 55.0

    fuel_update_response = await client.patch(
        f"/fuel-logs/{fuel_log_id}",
        headers=headers,
        json={
            "liters": 16.0,
            "cost": 140.0,
            "odometer": 1350.0,
        },
    )
    assert fuel_update_response.status_code == 200
    assert fuel_update_response.json()["cost"] == 140.0

    expense_update_response = await client.patch(
        f"/expenses/{expense_id}",
        headers=headers,
        json={
            "description": "Updated toll and parking",
            "amount": 65.0,
        },
    )
    assert expense_update_response.status_code == 200
    assert expense_update_response.json()["amount"] == 65.0

    fuel_list_response = await client.get(
        "/fuel-logs/",
        headers=headers,
        params={
            "vehicle_id": str(vehicle.id),
            "date_from": str(today),
            "date_to": str(today),
        },
    )
    assert fuel_list_response.status_code == 200
    assert any(item["id"] == fuel_log_id for item in fuel_list_response.json())

    expense_list_response = await client.get(
        "/expenses/",
        headers=headers,
        params={
            "vehicle_id": str(vehicle.id),
            "date_from": str(today),
            "date_to": str(today),
        },
    )
    assert expense_list_response.status_code == 200
    assert any(item["id"] == expense_id for item in expense_list_response.json())

    analytics_response = await client.get(
        "/analytics/summary",
        headers=headers,
        params={
            "vehicle_id": str(vehicle.id),
            "date_from": str(today),
            "date_to": str(today),
        },
    )
    assert analytics_response.status_code == 200
    summary = analytics_response.json()
    assert summary["total_fuel_cost"] == 140.0
    assert summary["total_maintenance_cost"] == 300.0
    assert summary["total_operational_cost"] == 440.0
    assert summary["total_other_expenses"] == 65.0
    assert summary["total_revenue"] == 1200.0
    assert summary["total_distance"] == 350.0
    assert summary["total_fuel_consumed"] == 35.0
    assert summary["fuel_efficiency"] == 10.0
    assert summary["vehicle_roi"] == 3.8

    analytics_export_response = await client.get(
        "/analytics/export",
        headers=headers,
        params={
            "vehicle_id": str(vehicle.id),
            "date_from": str(today),
            "date_to": str(today),
        },
    )
    assert analytics_export_response.status_code == 200
    assert analytics_export_response.headers["content-type"].startswith("text/csv")
    assert "Total Fuel Cost" in analytics_export_response.text
    assert "Vehicle ROI (%)" in analytics_export_response.text

    fuel_delete_response = await client.delete(f"/fuel-logs/{fuel_log_id}", headers=headers)
    assert fuel_delete_response.status_code == 200

    expense_delete_response = await client.delete(f"/expenses/{expense_id}", headers=headers)
    assert expense_delete_response.status_code == 200

    fuel_after_delete_response = await client.get(f"/fuel-logs/{fuel_log_id}", headers=headers)
    assert fuel_after_delete_response.status_code == 404

    expense_after_delete_response = await client.get(f"/expenses/{expense_id}", headers=headers)
    assert expense_after_delete_response.status_code == 404
