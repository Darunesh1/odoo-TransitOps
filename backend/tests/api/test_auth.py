import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


@pytest.mark.asyncio
async def test_register_user_success(
    client: AsyncClient, db_session: AsyncSession, mock_emails
):
    register_payload = {
        "email": "newuser@example.com",
        "password": "strongpassword123",
        "full_name": "New User",
    }
    response = await client.post("/auth/register", json=register_payload)

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User"
    assert data["is_active"] is True
    assert data["is_verified"] is False
    assert "id" in data

    # Verify user exists in database
    query = select(User).where(User.email == "newuser@example.com")
    result = await db_session.execute(query)
    user = result.scalar_one_or_none()
    assert user is not None
    assert user.is_verified is False

    # Check email background task was triggered
    assert len(mock_emails["verification_emails"]) == 1
    args, kwargs = mock_emails["verification_emails"][0]
    assert kwargs["email"] == "newuser@example.com"
    assert "token" in kwargs


@pytest.mark.asyncio
async def test_register_user_duplicate_email(client: AsyncClient):
    payload = {
        "email": "duplicate@example.com",
        "password": "strongpassword123",
        "full_name": "Test User",
    }
    # Register first time
    response = await client.post("/auth/register", json=payload)
    assert response.status_code == 201

    # Register second time
    response = await client.post("/auth/register", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "A user with this email already exists in the system."


@pytest.mark.asyncio
async def test_verify_email_success(
    client: AsyncClient, db_session: AsyncSession, mock_emails
):
    # 1. Register a user
    register_payload = {
        "email": "verify@example.com",
        "password": "strongpassword123",
        "full_name": "Verify Me",
    }
    await client.post("/auth/register", json=register_payload)

    # 2. Extract verification token from mock emails call
    assert len(mock_emails["verification_emails"]) == 1
    _, kwargs = mock_emails["verification_emails"][0]
    token = kwargs["token"]

    # 3. Hit the verification endpoint
    response = await client.get(f"/auth/verify-email?token={token}")
    assert response.status_code == 200
    assert response.json()["message"] == "Email verified successfully. Welcome onboard!"

    # 4. Check if status updated in DB
    query = select(User).where(User.email == "verify@example.com")
    result = await db_session.execute(query)
    user = result.scalar_one_or_none()
    assert user is not None
    assert user.is_verified is True

    # 5. Check if welcome email Celery task was scheduled
    assert len(mock_emails["welcome_emails"]) == 1
    _, welcome_kwargs = mock_emails["welcome_emails"][0]
    assert welcome_kwargs["email"] == "verify@example.com"


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, mock_emails):
    # Register and verify
    payload = {
        "email": "loginuser@example.com",
        "password": "mypassword123",
        "full_name": "Login User",
    }
    await client.post("/auth/register", json=payload)
    _, kwargs = mock_emails["verification_emails"][0]
    await client.get(f"/auth/verify-email?token={kwargs['token']}")

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
async def test_refresh_token_success(client: AsyncClient, mock_emails):
    # Register, verify, and log in
    payload = {
        "email": "refresh@example.com",
        "password": "password123",
        "full_name": "Refresh User",
    }
    await client.post("/auth/register", json=payload)
    _, kwargs = mock_emails["verification_emails"][0]
    await client.get(f"/auth/verify-email?token={kwargs['token']}")

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
