import uuid

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


async def create_admin_headers(
    client: AsyncClient,
    db_session: AsyncSession,
    email: str = "admin-list@test.com",
    password: str = "adminpassword123",
) -> dict:
    result = await db_session.execute(select(Role).where(Role.name == "ADMIN"))
    admin_role = result.scalar_one()

    admin_user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name="Admin User",
        roles=[admin_role],
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(admin_user)
    await db_session.commit()
    return await get_auth_headers(client, email, password)


async def create_user_with_roles(
    db_session: AsyncSession,
    email: str,
    password: str,
    full_name: str,
    role_names: list[str],
    *,
    is_active: bool = True,
) -> User:
    result = await db_session.execute(select(Role).where(Role.name.in_(role_names)))
    roles = result.scalars().all()
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        roles=roles,
        is_active=is_active,
        is_superuser="ADMIN" in role_names,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.mark.asyncio
async def test_admin_can_list_users(client: AsyncClient, db_session: AsyncSession):
    headers = await create_admin_headers(client, db_session)
    await create_user_with_roles(
        db_session,
        "list-a@test.com",
        "password123",
        "List A",
        ["FLEET_MANAGER"],
    )
    await create_user_with_roles(
        db_session,
        "list-b@test.com",
        "password123",
        "List B",
        ["DISPATCHER"],
    )

    response = await client.get("/users", headers=headers)
    assert response.status_code == 200

    data = response.json()
    emails = [item["email"] for item in data]
    assert "list-a@test.com" in emails
    assert "list-b@test.com" in emails


@pytest.mark.asyncio
async def test_admin_can_get_user_by_id(client: AsyncClient, db_session: AsyncSession):
    headers = await create_admin_headers(client, db_session)
    user = await create_user_with_roles(
        db_session,
        "detail@test.com",
        "password123",
        "Detail User",
        ["FLEET_MANAGER"],
    )

    response = await client.get(f"/users/{user.id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == "detail@test.com"


@pytest.mark.asyncio
async def test_admin_get_user_by_id_unknown_returns_404(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await create_admin_headers(client, db_session)
    response = await client.get(f"/users/{uuid.uuid4()}", headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


@pytest.mark.asyncio
async def test_non_admin_cannot_list_users(
    client: AsyncClient, db_session: AsyncSession
):
    result = await db_session.execute(select(Role).where(Role.name == "FLEET_MANAGER"))
    role_obj = result.scalar_one()
    user = User(
        email="nonadmin-list@test.com",
        hashed_password=hash_password("password123"),
        full_name="Non Admin",
        roles=[role_obj],
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    headers = await get_auth_headers(client, "nonadmin-list@test.com", "password123")

    response = await client.get("/users", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"


@pytest.mark.asyncio
async def test_non_admin_cannot_get_user_by_id(
    client: AsyncClient, db_session: AsyncSession
):
    result = await db_session.execute(select(Role).where(Role.name == "FLEET_MANAGER"))
    role_obj = result.scalar_one()
    user = User(
        email="nonadmin-detail@test.com",
        hashed_password=hash_password("password123"),
        full_name="Non Admin",
        roles=[role_obj],
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    headers = await get_auth_headers(client, "nonadmin-detail@test.com", "password123")

    response = await client.get(f"/users/{uuid.uuid4()}", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"


@pytest.mark.asyncio
async def test_users_routes_require_authentication(
    client: AsyncClient,
):
    response = await client.get("/users")
    assert response.status_code == 401

    response = await client.get(f"/users/{uuid.uuid4()}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_user_search_and_filters(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-search@test.com")

    active_user = await create_user_with_roles(
        db_session,
        "alex.dispatcher@test.com",
        "password123",
        "Alex Dispatcher",
        ["DISPATCHER"],
    )
    inactive_user = await create_user_with_roles(
        db_session,
        "inactive.person@test.com",
        "password123",
        "Inactive Person",
        ["SAFETY_OFFICER"],
        is_active=False,
    )
    await create_user_with_roles(
        db_session,
        "fleet.only@test.com",
        "password123",
        "Fleet Only",
        ["FLEET_MANAGER"],
    )

    search_response = await client.get(
        "/users",
        params={"search": "alex"},
        headers=headers,
    )
    assert search_response.status_code == 200
    search_data = search_response.json()
    assert any(item["email"] == "alex.dispatcher@test.com" for item in search_data)

    role_response = await client.get(
        "/users",
        params={"role": "DISPATCHER"},
        headers=headers,
    )
    assert role_response.status_code == 200
    role_data = role_response.json()
    assert all("DISPATCHER" in item["roles"] for item in role_data)

    active_response = await client.get(
        "/users",
        params={"is_active": True},
        headers=headers,
    )
    assert active_response.status_code == 200
    active_data = active_response.json()
    assert any(item["email"] == active_user.email for item in active_data)
    assert all(item["is_active"] is True for item in active_data)
    assert all(item["email"] != inactive_user.email for item in active_data)


@pytest.mark.asyncio
async def test_multi_role_user_appears_once(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-once@test.com")

    await create_user_with_roles(
        db_session,
        "multi-role@test.com",
        "password123",
        "Multi Role",
        ["FLEET_MANAGER", "SAFETY_OFFICER"],
    )
    await create_user_with_roles(
        db_session,
        "single-role@test.com",
        "password123",
        "Single Role",
        ["DISPATCHER"],
    )

    response = await client.get("/users", headers=headers)
    assert response.status_code == 200

    emails = [item["email"] for item in response.json()]
    assert emails.count("multi-role@test.com") == 1


@pytest.mark.asyncio
async def test_admin_updates_user_name(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-update-name@test.com")
    target = await create_user_with_roles(
        db_session,
        "update-name@test.com",
        "password123",
        "Original Name",
        ["FLEET_MANAGER"],
    )

    response = await client.patch(
        f"/users/{target.id}",
        headers=headers,
        json={"full_name": "Updated Name"},
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_admin_updates_user_email(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-update-email@test.com")
    target = await create_user_with_roles(
        db_session,
        "update-email@test.com",
        "password123",
        "Email User",
        ["FLEET_MANAGER"],
    )

    response = await client.patch(
        f"/users/{target.id}",
        headers=headers,
        json={"email": "updated-email@test.com"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "updated-email@test.com"


@pytest.mark.asyncio
async def test_admin_update_duplicate_email_returns_409(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-update-conflict@test.com")
    first = await create_user_with_roles(
        db_session,
        "first-email@test.com",
        "password123",
        "First User",
        ["FLEET_MANAGER"],
    )
    await create_user_with_roles(
        db_session,
        "second-email@test.com",
        "password123",
        "Second User",
        ["FLEET_MANAGER"],
    )

    response = await client.patch(
        f"/users/{first.id}",
        headers=headers,
        json={"email": "second-email@test.com"},
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_admin_update_unknown_user_returns_404(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-update-404@test.com")
    response = await client.patch(
        f"/users/{uuid.uuid4()}",
        headers=headers,
        json={"full_name": "Does Not Matter"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


@pytest.mark.asyncio
async def test_non_admin_cannot_update_user(
    client: AsyncClient,
    db_session: AsyncSession,
):
    target = await create_user_with_roles(
        db_session,
        "nonadmin-update@test.com",
        "password123",
        "Target User",
        ["FLEET_MANAGER"],
    )
    headers = await get_auth_headers(client, "nonadmin-update@test.com", "password123")

    response = await client.patch(
        f"/users/{target.id}",
        headers=headers,
        json={"full_name": "Not Allowed"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_deactivates_and_reactivates_user(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-toggle@test.com")
    target = await create_user_with_roles(
        db_session,
        "toggle-user@test.com",
        "password123",
        "Toggle User",
        ["FLEET_MANAGER"],
    )
    user_headers = await get_auth_headers(client, "toggle-user@test.com", "password123")

    deactivate_response = await client.post(f"/users/{target.id}/deactivate", headers=headers)
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["is_active"] is False

    me_response = await client.get("/users/me", headers=user_headers)
    assert me_response.status_code == 400

    login_response = await client.post(
        "/auth/login",
        data={"username": "toggle-user@test.com", "password": "password123"},
    )
    assert login_response.status_code == 400

    activate_response = await client.post(f"/users/{target.id}/activate", headers=headers)
    assert activate_response.status_code == 200
    assert activate_response.json()["is_active"] is True

    login_response = await client.post(
        "/auth/login",
        data={"username": "toggle-user@test.com", "password": "password123"},
    )
    assert login_response.status_code == 200
    tokens = login_response.json()
    reactivate_headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    me_response = await client.get("/users/me", headers=reactivate_headers)
    assert me_response.status_code == 200


@pytest.mark.asyncio
async def test_admin_cannot_deactivate_self(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-self@test.com")
    result = await db_session.execute(select(User).where(User.email == "admin-self@test.com"))
    admin_user = result.scalar_one()

    response = await client.post(f"/users/{admin_user.id}/deactivate", headers=headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "You cannot deactivate your own account."


@pytest.mark.asyncio
async def test_non_admin_cannot_activate_or_deactivate_users(
    client: AsyncClient,
    db_session: AsyncSession,
):
    target = await create_user_with_roles(
        db_session,
        "nonadmin-toggle-target@test.com",
        "password123",
        "Toggle Target",
        ["FLEET_MANAGER"],
    )
    headers = await get_auth_headers(client, "nonadmin-toggle-target@test.com", "password123")

    deactivate_response = await client.post(f"/users/{target.id}/deactivate", headers=headers)
    assert deactivate_response.status_code == 403

    activate_response = await client.post(f"/users/{target.id}/activate", headers=headers)
    assert activate_response.status_code == 403


@pytest.mark.asyncio
async def test_user_management_routes_require_authentication(
    client: AsyncClient,
):
    target_id = uuid.uuid4()

    response = await client.patch(f"/users/{target_id}", json={"full_name": "x"})
    assert response.status_code == 401

    response = await client.post(f"/users/{target_id}/deactivate")
    assert response.status_code == 401

    response = await client.post(f"/users/{target_id}/activate")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_adds_one_role_and_gains_access(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-add-one@test.com")
    user = await create_user_with_roles(
        db_session,
        "role-add-one@test.com",
        "password123",
        "Role Add One",
        ["FLEET_MANAGER"],
    )

    response = await client.post(
        f"/users/{user.id}/roles",
        headers=headers,
        json={"roles": ["SAFETY_OFFICER"]},
    )
    assert response.status_code == 200
    assert "SAFETY_OFFICER" in response.json()["roles"]

    updated_headers = await get_auth_headers(client, "role-add-one@test.com", "password123")
    assert (await client.get("/users/test-safety-officer", headers=updated_headers)).status_code == 200


@pytest.mark.asyncio
async def test_admin_adds_multiple_roles(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-add-multi@test.com")
    user = await create_user_with_roles(
        db_session,
        "role-add-multi@test.com",
        "password123",
        "Role Add Multi",
        ["DISPATCHER"],
    )

    response = await client.post(
        f"/users/{user.id}/roles",
        headers=headers,
        json={"roles": ["FLEET_MANAGER", "SAFETY_OFFICER"]},
    )
    assert response.status_code == 200
    roles = response.json()["roles"]
    assert "FLEET_MANAGER" in roles
    assert "SAFETY_OFFICER" in roles


@pytest.mark.asyncio
async def test_adding_existing_role_is_idempotent(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-add-idempotent@test.com")
    user = await create_user_with_roles(
        db_session,
        "role-add-idempotent@test.com",
        "password123",
        "Role Add Idempotent",
        ["FLEET_MANAGER"],
    )

    response = await client.post(
        f"/users/{user.id}/roles",
        headers=headers,
        json={"roles": ["FLEET_MANAGER"]},
    )
    assert response.status_code == 200
    assert response.json()["roles"].count("FLEET_MANAGER") == 1


@pytest.mark.asyncio
async def test_admin_remove_role_and_preserve_other_access(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-remove@test.com")
    user = await create_user_with_roles(
        db_session,
        "role-remove@test.com",
        "password123",
        "Role Remove",
        ["FLEET_MANAGER", "SAFETY_OFFICER"],
    )
    user_headers = await get_auth_headers(client, "role-remove@test.com", "password123")

    response = await client.delete(
        f"/users/{user.id}/roles/FLEET_MANAGER",
        headers=headers,
    )
    assert response.status_code == 200
    assert "FLEET_MANAGER" not in response.json()["roles"]
    assert "SAFETY_OFFICER" in response.json()["roles"]

    assert (await client.get("/users/test-fleet-manager", headers=user_headers)).status_code == 403
    assert (await client.get("/users/test-safety-officer", headers=user_headers)).status_code == 200


@pytest.mark.asyncio
async def test_cannot_remove_final_role(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-final-role@test.com")
    user = await create_user_with_roles(
        db_session,
        "role-final@test.com",
        "password123",
        "Role Final",
        ["FLEET_MANAGER"],
    )

    response = await client.delete(
        f"/users/{user.id}/roles/FLEET_MANAGER",
        headers=headers,
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_cannot_remove_final_active_admin_role(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-final-admin@test.com")
    result = await db_session.execute(select(Role).where(Role.name == "ADMIN"))
    admin_role = result.scalar_one()

    user = User(
        email="only-admin@test.com",
        hashed_password=hash_password("password123"),
        full_name="Only Admin",
        roles=[admin_role],
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()

    response = await client.delete(
        f"/users/{user.id}/roles/ADMIN",
        headers=headers,
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_admin_add_remove_admin_syncs_superuser_flag(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers = await create_admin_headers(client, db_session, email="admin-sync@test.com")
    user = await create_user_with_roles(
        db_session,
        "role-sync@test.com",
        "password123",
        "Role Sync",
        ["FLEET_MANAGER"],
    )

    add_response = await client.post(
        f"/users/{user.id}/roles",
        headers=headers,
        json={"roles": ["ADMIN"]},
    )
    assert add_response.status_code == 200
    assert add_response.json()["is_superuser"] is True

    remove_response = await client.delete(
        f"/users/{user.id}/roles/ADMIN",
        headers=headers,
    )
    assert remove_response.status_code == 200
    assert remove_response.json()["is_superuser"] is False


@pytest.mark.asyncio
async def test_role_management_unknown_user_and_permissions(
    client: AsyncClient,
    db_session: AsyncSession,
):
    admin_headers = await create_admin_headers(client, db_session, email="admin-role-missing@test.com")
    non_admin = await create_user_with_roles(
        db_session,
        "nonadmin-role@test.com",
        "password123",
        "Non Admin Role",
        ["FLEET_MANAGER"],
    )
    non_admin_headers = await get_auth_headers(client, "nonadmin-role@test.com", "password123")

    response = await client.post(
        f"/users/{uuid.uuid4()}/roles",
        headers=admin_headers,
        json={"roles": ["SAFETY_OFFICER"]},
    )
    assert response.status_code == 404

    response = await client.delete(
        f"/users/{uuid.uuid4()}/roles/SAFETY_OFFICER",
        headers=admin_headers,
    )
    assert response.status_code == 404

    response = await client.post(
        f"/users/{non_admin.id}/roles",
        headers=non_admin_headers,
        json={"roles": ["SAFETY_OFFICER"]},
    )
    assert response.status_code == 403

    response = await client.delete(
        f"/users/{non_admin.id}/roles/SAFETY_OFFICER",
        headers=non_admin_headers,
    )
    assert response.status_code == 403

    response = await client.post(
        f"/users/{non_admin.id}/roles",
        json={"roles": ["SAFETY_OFFICER"]},
    )
    assert response.status_code == 401
