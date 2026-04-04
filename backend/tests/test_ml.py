import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_model_info(client: AsyncClient):
    response = await client.get("/ml/model/info")
    assert response.status_code == 200
    data = response.json()
    # According to model info response, it has 'model_type'
    assert "model_type" in data
    assert "class_labels" in data

@pytest.mark.asyncio
async def test_predict_activity(client: AsyncClient):
    payload = {
        "points": [
            {"latitude": 45.0, "longitude": 9.0, "elevation": 200.0, "timestamp": 1690000000.0},
            {"latitude": 45.01, "longitude": 9.01, "elevation": 250.0, "timestamp": 1690000300.0}
        ]
    }
    response = await client.post("/ml/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_label" in data
    assert "confidence" in data

@pytest.mark.asyncio
async def test_gap_calculation(client: AsyncClient):
    payload = {
        "points": [
            {"latitude": 45.0, "longitude": 9.0, "altitude": 200.0, "timestamp": 1690000000.0},
            {"latitude": 45.01, "longitude": 9.01, "altitude": 250.0, "timestamp": 1690000300.0}
        ]
    }
    response = await client.post("/ml/gap", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "gap_avg_pace_min_km" in data
    assert "actual_avg_pace_min_km" in data

@pytest.mark.asyncio
async def test_terrain_scoring(client: AsyncClient):
    payload = {
        "points": [
            {"latitude": 45.0, "longitude": 9.0, "altitude": 200.0, "timestamp": 1690000000.0},
            {"latitude": 45.01, "longitude": 9.01, "altitude": 250.0, "timestamp": 1690000300.0}
        ]
    }
    response = await client.post("/ml/terrain", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "difficulty_label" in data
    assert "distance_score" in data
