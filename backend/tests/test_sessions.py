import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_start_session(client: AsyncClient, test_user, auth_headers):
    response = await client.post(
        "/sessions/start",
        headers=auth_headers,
        json={"activity_type": "TREKKING"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "active"
    assert data["activity_type"] == "TREKKING"
    assert "id" in data


@pytest.mark.asyncio
async def test_upload_points(client: AsyncClient, test_user, auth_headers):
    # Start a session first
    start_resp = await client.post(
        "/sessions/start",
        headers=auth_headers,
        json={"activity_type": "TREKKING"},
    )
    session_id = start_resp.json()["id"]

    # Upload GPS points
    points = [
        {
            "time": "2026-03-22T10:00:00Z",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "altitude": 216.0,
            "accuracy": 5.0,
            "speed": 1.2,
        },
        {
            "time": "2026-03-22T10:00:01Z",
            "latitude": 28.6140,
            "longitude": 77.2091,
            "altitude": 217.0,
            "accuracy": 4.5,
            "speed": 1.3,
        },
    ]
    response = await client.post(
        f"/sessions/{session_id}/points",
        headers=auth_headers,
        json={"points": points},
    )
    assert response.status_code == 202
    data = response.json()
    assert data["accepted"] == 2


@pytest.mark.asyncio
async def test_end_session(client: AsyncClient, test_user, auth_headers):
    # Start session
    start_resp = await client.post(
        "/sessions/start",
        headers=auth_headers,
        json={"activity_type": "TRAIL_RUNNING"},
    )
    session_id = start_resp.json()["id"]

    # End session
    response = await client.post(
        f"/sessions/{session_id}/end",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["end_time"] is not None


@pytest.mark.asyncio
async def test_get_session_summary(client: AsyncClient, test_user, auth_headers):
    # Start and end a session
    start_resp = await client.post(
        "/sessions/start",
        headers=auth_headers,
        json={"activity_type": "TREKKING"},
    )
    session_id = start_resp.json()["id"]
    await client.post(f"/sessions/{session_id}/end", headers=auth_headers)

    # Get summary
    response = await client.get(
        f"/sessions/{session_id}/summary",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == session_id
    assert data["status"] == "completed"


@pytest.mark.asyncio
async def test_get_track_geojson(client: AsyncClient, test_user, auth_headers):
    # Start session
    start_resp = await client.post(
        "/sessions/start",
        headers=auth_headers,
        json={"activity_type": "TREKKING"},
    )
    session_id = start_resp.json()["id"]

    # Upload some points
    points = [
        {
            "time": "2026-03-22T10:00:00Z",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "altitude": 216.0,
        },
    ]
    await client.post(
        f"/sessions/{session_id}/points",
        headers=auth_headers,
        json={"points": points},
    )

    # Get track
    response = await client.get(
        f"/sessions/{session_id}/track",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 1


@pytest.mark.asyncio
async def test_export_gpx(client: AsyncClient, test_user, auth_headers):
    # Start session
    start_resp = await client.post(
        "/sessions/start",
        headers=auth_headers,
        json={"activity_type": "TREKKING"},
    )
    session_id = start_resp.json()["id"]

    # Export as GPX
    response = await client.get(
        f"/sessions/{session_id}/export?format=gpx",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert "application/gpx+xml" in response.headers["content-type"]


@pytest.mark.asyncio
async def test_export_kml(client: AsyncClient, test_user, auth_headers):
    # Start session
    start_resp = await client.post(
        "/sessions/start",
        headers=auth_headers,
        json={"activity_type": "TREKKING"},
    )
    session_id = start_resp.json()["id"]

    # Export as KML
    response = await client.get(
        f"/sessions/{session_id}/export?format=kml",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert "application/vnd.google-earth.kml+xml" in response.headers["content-type"]


@pytest.mark.asyncio
async def test_user_history(client: AsyncClient, test_user, auth_headers):
    user, _ = test_user

    # Create a few sessions
    for _ in range(3):
        resp = await client.post(
            "/sessions/start",
            headers=auth_headers,
            json={"activity_type": "TREKKING"},
        )
        session_id = resp.json()["id"]
        await client.post(f"/sessions/{session_id}/end", headers=auth_headers)

    # Get history
    response = await client.get(
        f"/sessions/user/{user.id}/history",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3
    assert data["has_next"] is False


@pytest.mark.asyncio
async def test_session_not_found(client: AsyncClient, test_user, auth_headers):
    fake_id = uuid.uuid4()
    response = await client.get(
        f"/sessions/{fake_id}/summary",
        headers=auth_headers,
    )
    assert response.status_code == 404
