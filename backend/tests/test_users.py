import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_own_profile(client: AsyncClient, test_user, auth_headers):
    user, _ = test_user
    response = await client.get(f"/users/{user.id}/profile", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "trekker@test.com"
    assert data["display_name"] == "Test Trekker"


@pytest.mark.asyncio
async def test_update_own_profile(client: AsyncClient, test_user, auth_headers):
    user, _ = test_user
    response = await client.put(
        f"/users/{user.id}/profile",
        headers=auth_headers,
        json={"display_name": "Updated Trekker"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["display_name"] == "Updated Trekker"


@pytest.mark.asyncio
async def test_update_other_user_profile_forbidden(client: AsyncClient, test_user, auth_headers):
    import uuid

    other_user_id = uuid.uuid4()
    response = await client.put(
        f"/users/{other_user_id}/profile",
        headers=auth_headers,
        json={"display_name": "Hacker"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_profile_no_auth(client: AsyncClient, test_user):
    user, _ = test_user
    response = await client.get(f"/users/{user.id}/profile")
    assert response.status_code == 422  # Missing Authorization header
