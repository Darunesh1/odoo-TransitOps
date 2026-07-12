import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserRole, Role
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

    # Retrieve role
    result = await db_session.execute(select(Role).where(Role.name == "FLEET_MANAGER"))
    role_obj = result.scalar_one()

    # Create user directly in DB
    user = User(
        email=email,
        hashed_password=hash_password(pwd),
        full_name="Me User",
        roles=[role_obj],
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
    assert "FLEET_MANAGER" in data["roles"]


@pytest.mark.asyncio
async def test_get_me_unauthorized(client: AsyncClient):
    response = await client.get("/users/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_me_success(client: AsyncClient, db_session: AsyncSession):
    email = "update@example.com"
    pwd = "password123"

    # Retrieve role
    result = await db_session.execute(select(Role).where(Role.name == "FLEET_MANAGER"))
    role_obj = result.scalar_one()

    # Create user directly in DB
    user = User(
        email=email,
        hashed_password=hash_password(pwd),
        full_name="Original Name",
        roles=[role_obj],
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

    # Retrieve role
    result = await db_session.execute(select(Role).where(Role.name == "FLEET_MANAGER"))
    role_obj = result.scalar_one()

    # Create User A
    email_a = "usera@example.com"
    user_a = User(
        email=email_a,
        hashed_password=hash_password(pwd),
        full_name="User A",
        roles=[role_obj],
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
        roles=[role_obj],
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
    assert response.status_code == 409
    assert response.json()["detail"] == "A user with this email address already exists."


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role,expected_is_superuser",
    [
        ("ADMIN", True),
        ("FLEET_MANAGER", False),
        ("DISPATCHER", False),
        ("SAFETY_OFFICER", False),
        ("FINANCIAL_ANALYST", False),
    ],
)
async def test_admin_creates_users_and_verifies_superuser_status(
    client: AsyncClient, db_session: AsyncSession, role: str, expected_is_superuser: bool
):
    # Retrieve ADMIN role
    result = await db_session.execute(select(Role).where(Role.name == "ADMIN"))
    admin_role = result.scalar_one()

    # Create a superuser in the DB to make the API call
    superuser_email = "super@example.com"
    superuser_pwd = "superpassword123"
    superuser = User(
        email=superuser_email,
        hashed_password=hash_password(superuser_pwd),
        full_name="Super Admin",
        roles=[admin_role],
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(superuser)
    await db_session.commit()

    headers = await get_auth_headers(client, superuser_email, superuser_pwd)

    # Call the create user endpoint
    new_user_email = f"new_{role.lower()}@example.com"
    new_user_pwd = "newpassword123"
    payload = {
        "email": new_user_email,
        "password": new_user_pwd,
        "full_name": f"New {role}",
        "roles": [role],
    }

    response = await client.post("/users/", headers=headers, json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == new_user_email
    assert role in data["roles"]

    # Check directly in DB for superuser status
    query = select(User).where(User.email == new_user_email)
    result = await db_session.execute(query)
    db_user = result.scalar_one_or_none()
    assert db_user is not None
    assert db_user.is_superuser is expected_is_superuser
    assert db_user.is_verified is True

    # Verify login functionality for this created user
    login_headers = await get_auth_headers(client, new_user_email, new_user_pwd)
    profile_response = await client.get("/users/me", headers=login_headers)
    assert profile_response.status_code == 200
    assert role in profile_response.json()["roles"]


@pytest.mark.asyncio
async def test_non_admin_creates_user_forbidden(client: AsyncClient, db_session: AsyncSession):
    # Retrieve role
    result = await db_session.execute(select(Role).where(Role.name == "FLEET_MANAGER"))
    role_obj = result.scalar_one()

    # Create a regular user
    user_email = "regular@example.com"
    user_pwd = "userpassword123"
    user = User(
        email=user_email,
        hashed_password=hash_password(user_pwd),
        full_name="Regular User",
        roles=[role_obj],
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
        "roles": ["DISPATCHER"],
    }

    response = await client.post("/users/", headers=headers, json=payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"


@pytest.mark.asyncio
async def test_create_user_unauthenticated(client: AsyncClient):
    payload = {
        "email": "someother@example.com",
        "password": "somepassword123",
        "full_name": "Some User",
        "roles": ["DISPATCHER"],
    }
    # No JWT
    response = await client.post("/users/", json=payload)
    assert response.status_code == 401

    # Invalid JWT
    response = await client.post(
        "/users/", headers={"Authorization": "Bearer invalidtoken"}, json=payload
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_user_duplicate_email(client: AsyncClient, db_session: AsyncSession):
    # Retrieve roles
    res1 = await db_session.execute(select(Role).where(Role.name == "ADMIN"))
    admin_role = res1.scalar_one()
    res2 = await db_session.execute(select(Role).where(Role.name == "FLEET_MANAGER"))
    fleet_role = res2.scalar_one()

    # Create superuser
    superuser_email = "super@example.com"
    superuser_pwd = "superpassword123"
    superuser = User(
        email=superuser_email,
        hashed_password=hash_password(superuser_pwd),
        full_name="Super Admin",
        roles=[admin_role],
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(superuser)

    # Create an existing user
    existing_email = "existing@example.com"
    existing_user = User(
        email=existing_email,
        hashed_password=hash_password("password123"),
        full_name="Existing User",
        roles=[fleet_role],
        is_active=True,
        is_verified=True,
    )
    db_session.add(existing_user)
    await db_session.commit()

    headers = await get_auth_headers(client, superuser_email, superuser_pwd)

    payload = {
        "email": existing_email,
        "password": "somepassword123",
        "full_name": "New User",
        "roles": ["DISPATCHER"],
    }

    response = await client.post("/users/", headers=headers, json=payload)
    assert response.status_code == 409
    assert response.json()["detail"] == "A user with this email already exists in the system."


@pytest.mark.asyncio
async def test_create_user_invalid_role(client: AsyncClient, db_session: AsyncSession):
    # Retrieve ADMIN role
    result = await db_session.execute(select(Role).where(Role.name == "ADMIN"))
    admin_role = result.scalar_one()

    superuser_email = "super@example.com"
    superuser_pwd = "superpassword123"
    superuser = User(
        email=superuser_email,
        hashed_password=hash_password(superuser_pwd),
        full_name="Super Admin",
        roles=[admin_role],
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(superuser)
    await db_session.commit()

    headers = await get_auth_headers(client, superuser_email, superuser_pwd)

    payload = {
        "email": "invalidrole@example.com",
        "password": "somepassword123",
        "full_name": "New User",
        "roles": ["INVALID_ROLE_NAME"],
    }

    response = await client.post("/users/", headers=headers, json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_multi_role_user_success(client: AsyncClient, db_session: AsyncSession):
    # Retrieve ADMIN role
    result = await db_session.execute(select(Role).where(Role.name == "ADMIN"))
    admin_role = result.scalar_one()

    superuser_email = "super@example.com"
    superuser_pwd = "superpassword123"
    superuser = User(
        email=superuser_email,
        hashed_password=hash_password(superuser_pwd),
        full_name="Super Admin",
        roles=[admin_role],
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(superuser)
    await db_session.commit()

    headers = await get_auth_headers(client, superuser_email, superuser_pwd)

    payload = {
        "email": "multirole@example.com",
        "password": "somepassword123",
        "full_name": "Multi User",
        "roles": ["FLEET_MANAGER", "SAFETY_OFFICER"],
    }

    response = await client.post("/users/", headers=headers, json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "FLEET_MANAGER" in data["roles"]
    assert "SAFETY_OFFICER" in data["roles"]


@pytest.mark.asyncio
async def test_create_user_empty_roles_failure(client: AsyncClient, db_session: AsyncSession):
    # Retrieve ADMIN role
    result = await db_session.execute(select(Role).where(Role.name == "ADMIN"))
    admin_role = result.scalar_one()

    superuser_email = "super@example.com"
    superuser_pwd = "superpassword123"
    superuser = User(
        email=superuser_email,
        hashed_password=hash_password(superuser_pwd),
        full_name="Super Admin",
        roles=[admin_role],
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(superuser)
    await db_session.commit()

    headers = await get_auth_headers(client, superuser_email, superuser_pwd)

    payload = {
        "email": "emptyroles@example.com",
        "password": "somepassword123",
        "full_name": "Empty User",
        "roles": [],
    }

    response = await client.post("/users/", headers=headers, json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_user_duplicate_roles_deduplicated(client: AsyncClient, db_session: AsyncSession):
    # Retrieve ADMIN role
    result = await db_session.execute(select(Role).where(Role.name == "ADMIN"))
    admin_role = result.scalar_one()

    superuser_email = "super@example.com"
    superuser_pwd = "superpassword123"
    superuser = User(
        email=superuser_email,
        hashed_password=hash_password(superuser_pwd),
        full_name="Super Admin",
        roles=[admin_role],
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(superuser)
    await db_session.commit()

    headers = await get_auth_headers(client, superuser_email, superuser_pwd)

    payload = {
        "email": "duproles@example.com",
        "password": "somepassword123",
        "full_name": "Dup User",
        "roles": ["FLEET_MANAGER", "FLEET_MANAGER"],
    }

    response = await client.post("/users/", headers=headers, json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["roles"] == ["FLEET_MANAGER"]


@pytest.mark.asyncio
async def test_multi_role_access_control(client: AsyncClient, db_session: AsyncSession):
    # Retrieve roles
    res1 = await db_session.execute(select(Role).where(Role.name == "FLEET_MANAGER"))
    fleet_role = res1.scalar_one()
    res2 = await db_session.execute(select(Role).where(Role.name == "SAFETY_OFFICER"))
    safety_role = res2.scalar_one()
    res3 = await db_session.execute(select(Role).where(Role.name == "ADMIN"))
    admin_role = res3.scalar_one()

    # Create multi-role user
    multi_email = "multiuser@example.com"
    multi_pwd = "password123"
    multi_user = User(
        email=multi_email,
        hashed_password=hash_password(multi_pwd),
        full_name="Multi User",
        roles=[fleet_role, safety_role],
        is_active=True,
        is_verified=True,
    )
    db_session.add(multi_user)
    await db_session.commit()

    headers = await get_auth_headers(client, multi_email, multi_pwd)

    # 1. Access FLEET_MANAGER endpoint -> Allowed
    response = await client.get("/users/test-fleet-manager", headers=headers)
    assert response.status_code == 200

    # 2. Access SAFETY_OFFICER endpoint -> Allowed
    response = await client.get("/users/test-safety-officer", headers=headers)
    assert response.status_code == 200

    # 3. Access ADMIN-only user creation endpoint -> Forbidden (403)
    payload = {
        "email": "testother@example.com",
        "password": "somepassword123",
        "full_name": "Test User",
        "roles": ["DISPATCHER"],
    }
    response = await client.post("/users/", headers=headers, json=payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"

    # 4. Create an ADMIN user and verify they can bypass any role check
    admin_email = "adminuser@example.com"
    admin_pwd = "password123"
    admin_user = User(
        email=admin_email,
        hashed_password=hash_password(admin_pwd),
        full_name="Admin User",
        roles=[admin_role],
        is_active=True,
        is_verified=True,
    )
    db_session.add(admin_user)
    await db_session.commit()

    admin_headers = await get_auth_headers(client, admin_email, admin_pwd)

    # Admin calls FLEET_MANAGER endpoint -> Allowed (bypassed)
    response = await client.get("/users/test-fleet-manager", headers=admin_headers)
    assert response.status_code == 200

    # Admin calls SAFETY_OFFICER endpoint -> Allowed (bypassed)
    response = await client.get("/users/test-safety-officer", headers=admin_headers)
    assert response.status_code == 200
