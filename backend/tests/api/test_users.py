import pytest
from httpx import AsyncClient


async def get_auth_headers(client: AsyncClient, email: str, password: str) -> dict:
    """Helper to perform login and construct authorization headers."""
    login_data = {"username": email, "password": password}
    response = await client.post("/auth/login", data=login_data)
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.mark.asyncio
async def test_get_me_success(client: AsyncClient, mock_emails):
    # Register, verify, and login user
    email = "me@example.com"
    pwd = "password123"
    await client.post(
        "/auth/register",
        json={"email": email, "password": pwd, "full_name": "Me User"},
    )
    _, kwargs = mock_emails["verification_emails"][0]
    await client.get(f"/auth/verify-email?token={kwargs['token']}")

    headers = await get_auth_headers(client, email, pwd)

    # Get profiles
    response = await client.get("/users/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == email
    assert data["full_name"] == "Me User"


@pytest.mark.asyncio
async def test_get_me_unauthorized(client: AsyncClient):
    response = await client.get("/users/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_me_success(client: AsyncClient, mock_emails):
    email = "update@example.com"
    pwd = "password123"
    await client.post(
        "/auth/register",
        json={"email": email, "password": pwd, "full_name": "Original Name"},
    )
    _, kwargs = mock_emails["verification_emails"][0]
    await client.get(f"/auth/verify-email?token={kwargs['token']}")

    headers = await get_auth_headers(client, email, pwd)

    # Update profile name
    update_payload = {"full_name": "Updated Name"}
    response = await client.put("/users/me", headers=headers, json=update_payload)
    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_update_me_email_conflict(client: AsyncClient, mock_emails):
    # Register and verify User A
    email_a = "usera@example.com"
    pwd = "password123"
    await client.post(
        "/auth/register",
        json={"email": email_a, "password": pwd, "full_name": "User A"},
    )
    token_a = mock_emails["verification_emails"][0][1]["token"]
    await client.get(f"/auth/verify-email?token={token_a}")

    # Register and verify User B
    email_b = "userb@example.com"
    await client.post(
        "/auth/register",
        json={"email": email_b, "password": pwd, "full_name": "User B"},
    )
    token_b = mock_emails["verification_emails"][1][1]["token"]
    await client.get(f"/auth/verify-email?token={token_b}")

    # Log in as User B
    headers_b = await get_auth_headers(client, email_b, pwd)

    # Try updating User B's email to User A's email (conflict expected)
    conflict_payload = {"email": email_a}
    response = await client.put("/users/me", headers=headers_b, json=conflict_payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "A user with this email address already exists."
