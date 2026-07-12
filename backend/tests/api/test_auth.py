import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.core.security import hash_password


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, db_session: AsyncSession):
    # Create user in DB
    hashed_pwd = hash_password("mypassword123")
    user = User(
        email="loginuser@example.com",
        hashed_password=hashed_pwd,
        full_name="Login User",
        role=UserRole.FLEET_MANAGER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()

    # Perform login
    login_data = {
        "username": "loginuser@example.com",
        "password": "mypassword123",
    }
    response = await client.post("/auth/login", data=login_data)
    assert response.status_code == 200
    token_response = response.json()
    assert "access_token" in token_response
    assert "refresh_token" in token_response
    assert token_response["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_failure(client: AsyncClient):
    login_data = {
        "username": "nonexistent@example.com",
        "password": "wrongpassword",
    }
    response = await client.post("/auth/login", data=login_data)
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


@pytest.mark.asyncio
async def test_refresh_token_success(client: AsyncClient, db_session: AsyncSession):
    # Create user in DB
    hashed_pwd = hash_password("password123")
    user = User(
        email="refresh@example.com",
        hashed_password=hashed_pwd,
        full_name="Refresh User",
        role=UserRole.FLEET_MANAGER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()

    login_res = await client.post(
        "/auth/login",
        data={"username": "refresh@example.com", "password": "password123"},
    )
    tokens = login_res.json()
    refresh_token = tokens["refresh_token"]

    # Exchange refresh token
    response = await client.post(
        "/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert response.status_code == 200
    new_tokens = response.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
