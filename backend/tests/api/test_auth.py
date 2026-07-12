import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.core.security import hash_password
from app.api.endpoints.auth import create_verification_token


@pytest.mark.asyncio
async def test_verify_email_success(
    client: AsyncClient, db_session: AsyncSession, mock_emails
):
    # 1. Create an unverified user in DB
    hashed_pwd = hash_password("strongpassword123")
    user = User(
        email="verify@example.com",
        hashed_password=hashed_pwd,
        full_name="Verify Me",
        role=UserRole.FLEET_MANAGER,
        is_active=True,
        is_verified=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # 2. Generate verification token
    token = create_verification_token(str(user.id))

    # 3. Hit the verification endpoint
    response = await client.get(f"/auth/verify-email?token={token}")
    assert response.status_code == 200
    assert response.json()["message"] == "Email verified successfully. Welcome onboard!"

    # 4. Check if status updated in DB
    query = select(User).where(User.email == "verify@example.com")
    result = await db_session.execute(query)
    updated_user = result.scalar_one_or_none()
    assert updated_user is not None
    assert updated_user.is_verified is True

    # 5. Check if welcome email Celery task was scheduled
    assert len(mock_emails["welcome_emails"]) == 1
    _, welcome_kwargs = mock_emails["welcome_emails"][0]
    assert welcome_kwargs["email"] == "verify@example.com"


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
