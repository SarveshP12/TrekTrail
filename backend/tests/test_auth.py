import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    response = await client.post(
        "/auth/register",
        json={
            "email": "newuser@test.com",
            "display_name": "New User",
            "password": "securepass123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@test.com"
    assert data["display_name"] == "New User"
    assert "id" in data
    assert "password" not in data
    assert "password_hash" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    # Register first time
    await client.post(
        "/auth/register",
        json={
            "email": "duplicate@test.com",
            "display_name": "First User",
            "password": "securepass123",
        },
    )
    # Try to register again with same email
    response = await client.post(
        "/auth/register",
        json={
            "email": "duplicate@test.com",
            "display_name": "Second User",
            "password": "securepass456",
        },
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_register_invalid_email(client: AsyncClient):
    response = await client.post(
        "/auth/register",
        json={
            "email": "not-an-email",
            "display_name": "Bad Email User",
            "password": "securepass123",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient):
    response = await client.post(
        "/auth/register",
        json={
            "email": "user@test.com",
            "display_name": "Short Pass User",
            "password": "short",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    # Register first
    await client.post(
        "/auth/register",
        json={
            "email": "loginuser@test.com",
            "display_name": "Login User",
            "password": "securepass123",
        },
    )
    # Login
    response = await client.post(
        "/auth/login",
        json={"email": "loginuser@test.com", "password": "securepass123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user_id" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    # Register first
    await client.post(
        "/auth/register",
        json={
            "email": "wrongpass@test.com",
            "display_name": "Wrong Pass",
            "password": "securepass123",
        },
    )
    # Login with wrong password
    response = await client.post(
        "/auth/login",
        json={"email": "wrongpass@test.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    response = await client.post(
        "/auth/login",
        json={"email": "nobody@test.com", "password": "securepass123"},
    )
    assert response.status_code == 401
