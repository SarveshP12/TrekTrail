import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_check():
    """Test the health check endpoint returns 200 and correct structure."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    
    # We expect 200 OK regardless of component status (it returns degraded status string but 200 code usually)
    # If the app raises exception on connection failure, it might be 500, but our code catches exceptions.
    
    assert response.status_code == 200
    data = response.json()
    
    # Check required fields
    assert "status" in data
    assert "version" in data
    assert "database" in data
    assert "timescaledb" in data
    assert "redis" in data
    
    # Version should match
    assert data["version"] == "0.1.0"
    
    # Status should be either healthy or degraded/unhealthy (since we don't have real DBs running in test env usually)
    assert data["status"] in ["healthy", "degraded", "unhealthy"]
