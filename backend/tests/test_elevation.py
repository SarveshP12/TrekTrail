from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@patch("app.services.elevation_service.get_redis")
async def test_elevation_lookup_cached(
    mock_get_redis, client: AsyncClient, test_user, auth_headers
):
    # Mock Redis to return a cached value
    mock_redis = AsyncMock()
    mock_redis.get.return_value = "1500.5"
    mock_get_redis.return_value = mock_redis

    response = await client.get(
        "/elevation/lookup?lat=28.6139&lng=77.2090",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["latitude"] == 28.6139
    assert data["longitude"] == 77.2090
    assert data["elevation"] == 1500.5


@pytest.mark.asyncio
async def test_elevation_lookup_invalid_coords(client: AsyncClient, test_user, auth_headers):
    response = await client.get(
        "/elevation/lookup?lat=91&lng=77",
        headers=auth_headers,
    )
    assert response.status_code == 422  # Latitude must be <= 90


@pytest.mark.asyncio
async def test_elevation_lookup_no_auth(client: AsyncClient):
    response = await client.get("/elevation/lookup?lat=28.6139&lng=77.2090")
    assert response.status_code == 422  # Missing auth header
