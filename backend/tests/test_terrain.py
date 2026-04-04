import pytest
from app.services.terrain_service import compute_terrain_difficulty_from_points

def test_flat_route():
    points = [
        {"latitude": 0, "longitude": 0, "altitude": 10},
        {"latitude": 0, "longitude": 0.01, "altitude": 10}, # ~1.1km flat
    ]
    res = compute_terrain_difficulty_from_points(points)
    assert res.overall_score <= 3
    assert res.difficulty_label == "Easy"

def test_mountain_route():
    points = []
    # simulate steep climb
    lat = 0.0
    lon = 0.0
    alt = 100.0
    from datetime import datetime, timedelta, timezone
    
    t = datetime.now(timezone.utc)
    for _ in range(10):
        points.append({"latitude": lat, "longitude": lon, "altitude": alt, "time": t})
        lat += 0.001  # ~111m
        alt += 20.0   # ~18% grade
        t += timedelta(seconds=10)
    res = compute_terrain_difficulty_from_points(points)
    assert res.overall_score >= 3.5
    assert res.difficulty_label in ["Moderate", "Hard", "Expert", "Extreme"]

