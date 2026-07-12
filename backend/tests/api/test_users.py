import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.core.security import hash_password


async def get_auth_headers(client: AsyncClient, email: str, password: str) -> dict:
    """Helper to perform login and construct authorization headers."""
    login_data = {"username": email, "password": password}
    response = await client.post("/auth/login", data=login_data)
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.mark.asyncio
async def test_get_me_success(client: AsyncClient, db_session: AsyncSession):
    email = "me@example.com"
    pwd = "password123"

    # Create user directly in DB
    user = User(
        email=email,
        hashed_password=hash_password(pwd),
        full_name="Me User",
        role=UserRole.FLEET_MANAGER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()

    headers = await get_auth_headers(client, email, pwd)

    # Get profile
    response = await client.get("/users/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == email
    assert data["full_name"] == "Me User"
    assert data["role"] == "FLEET_MANAGER"


@pytest.mark.asyncio
async def test_get_me_unauthorized(client: AsyncClient):
    response = await client.get("/users/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_me_success(client: AsyncClient, db_session: AsyncSession):
    email = "update@example.com"
    pwd = "password123"

    # Create user directly in DB
    user = User(
        email=email,
        hashed_password=hash_password(pwd),
        full_name="Original Name",
        role=UserRole.FLEET_MANAGER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()

    headers = await get_auth_headers(client, email, pwd)

    # Update profile name
    update_payload = {"full_name": "Updated Name"}
    response = await client.put("/users/me", headers=headers, json=update_payload)
    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_update_me_email_conflict(client: AsyncClient, db_session: AsyncSession):
    pwd = "password123"

    # Create User A
    email_a = "usera@example.com"
    user_a = User(
        email=email_a,
        hashed_password=hash_password(pwd),
        full_name="User A",
        role=UserRole.FLEET_MANAGER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user_a)

    # Create User B
    email_b = "userb@example.com"
    user_b = User(
        email=email_b,
        hashed_password=hash_password(pwd),
        full_name="User B",
        role=UserRole.FLEET_MANAGER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user_b)
    await db_session.commit()

    # Log in as User B
    headers_b = await get_auth_headers(client, email_b, pwd)

    # Try updating User B's email to User A's email (conflict expected)
    conflict_payload = {"email": email_a}
    response = await client.put("/users/me", headers=headers_b, json=conflict_payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "A user with this email address already exists."


@pytest.mark.asyncio
async def test_create_user_by_superuser_success(client: AsyncClient, db_session: AsyncSession):
    # Create a superuser in the DB
    superuser_email = "super@example.com"
    superuser_pwd = "superpassword123"
    superuser = User(
        email=superuser_email,
        hashed_password=hash_password(superuser_pwd),
        full_name="Super Admin",
        role=UserRole.ADMIN,
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(superuser)
    await db_session.commit()

    headers = await get_auth_headers(client, superuser_email, superuser_pwd)

    payload = {
        "email": "newfleet@example.com",
        "password": "somepassword123",
        "full_name": "Fleet Mgr",
        "role": "FLEET_MANAGER",
        "is_superuser": False
    }

    response = await client.post("/users/", headers=headers, json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newfleet@example.com"
    assert data["full_name"] == "Fleet Mgr"
    assert data["role"] == "FLEET_MANAGER"
    assert data["is_superuser"] is False
    assert data["is_verified"] is True


@pytest.mark.asyncio
async def test_create_user_by_regular_user_forbidden(client: AsyncClient, db_session: AsyncSession):
    # Create a regular user
    user_email = "regular@example.com"
    user_pwd = "userpassword123"
    user = User(
        email=user_email,
        hashed_password=hash_password(user_pwd),
        full_name="Regular User",
        role=UserRole.FLEET_MANAGER,
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()

    headers = await get_auth_headers(client, user_email, user_pwd)

    payload = {
        "email": "someother@example.com",
        "password": "somepassword123",
        "full_name": "Some User",
        "role": "DISPATCHER",
        "is_superuser": False
    }

    # Regular user tries to create another user
    response = await client.post("/users/", headers=headers, json=payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "The user does not have enough privileges"
