import pytest
from app.utils.distance import (
    compute_trek_stats,
    distance_3d,
    haversine_2d,
)
from datetime import datetime, timezone, timedelta


class TestHaversine2D:
    def test_same_point_returns_zero(self):
        assert haversine_2d(0, 0, 0, 0) == 0.0

    def test_one_degree_longitude_at_equator(self):
        # 1 degree of longitude at the equator ≈ 111,195 m
        result = haversine_2d(0, 0, 0, 1)
        assert 111_000 < result < 112_000

    def test_one_degree_latitude(self):
        # 1 degree of latitude ≈ 111,195 m
        result = haversine_2d(0, 0, 1, 0)
        assert 111_000 < result < 112_000

    def test_known_distance_delhi_to_mumbai(self):
        # Delhi (28.6139, 77.2090) to Mumbai (19.0760, 72.8777)
        result = haversine_2d(28.6139, 77.2090, 19.0760, 72.8777)
        # Approximately 1,148 km
        assert 1_100_000 < result < 1_200_000


class TestDistance3D:
    def test_purely_vertical(self):
        # Same lat/lon, 100m altitude difference
        result = distance_3d(0, 0, 0, 0, 0, 100)
        assert 99.5 < result < 100.5

    def test_purely_horizontal(self):
        # Same altitude, check it's close to 2D result
        d2d = haversine_2d(0, 0, 0, 1)
        d3d = distance_3d(0, 0, 0, 0, 1, 0)
        assert abs(d2d - d3d) < 1.0  # Should be identical

    def test_3d_greater_than_2d(self):
        # 3D distance must always be >= 2D distance
        d2d = haversine_2d(28.6139, 77.2090, 28.6140, 77.2091)
        d3d = distance_3d(28.6139, 77.2090, 200, 28.6140, 77.2091, 300)
        assert d3d >= d2d


class TestComputeTrekStats:
    def test_empty_points(self):
        stats = compute_trek_stats([])
        assert stats["distance_2d"] == 0
        assert stats["distance_3d"] == 0
        assert stats["difficulty_rating"] == "Easy"

    def test_single_point(self):
        stats = compute_trek_stats(
            [
                {
                    "latitude": 28.6139,
                    "longitude": 77.2090,
                    "altitude": 200,
                    "time": datetime(2026, 1, 1, tzinfo=timezone.utc),
                }
            ]
        )
        assert stats["distance_2d"] == 0

    def test_two_points_computes_distance(self):
        t1 = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        t2 = datetime(2026, 1, 1, 10, 1, 0, tzinfo=timezone.utc)  # 1 minute later
        stats = compute_trek_stats(
            [
                {
                    "latitude": 28.6139,
                    "longitude": 77.2090,
                    "altitude": 200,
                    "time": t1,
                },
                {
                    "latitude": 28.6140,
                    "longitude": 77.2091,
                    "altitude": 210,
                    "time": t2,
                },
            ]
        )
        assert stats["distance_2d"] > 0
        assert stats["distance_3d"] > stats["distance_2d"]
        assert stats["elevation_gain"] == 10.0
        assert stats["elevation_loss"] == 0.0
        assert stats["max_altitude"] == 210.0
        assert stats["min_altitude"] == 200.0
        assert stats["avg_speed"] > 0

    def test_elevation_gain_and_loss(self):
        base_time = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        stats = compute_trek_stats(
            [
                {"latitude": 0, "longitude": 0, "altitude": 100, "time": base_time},
                {
                    "latitude": 0,
                    "longitude": 0.001,
                    "altitude": 200,
                    "time": base_time + timedelta(minutes=1),
                },
                {
                    "latitude": 0,
                    "longitude": 0.002,
                    "altitude": 150,
                    "time": base_time + timedelta(minutes=2),
                },
            ]
        )
        assert stats["elevation_gain"] == 100.0
        assert stats["elevation_loss"] == 50.0

    def test_difficulty_easy(self):
        base_time = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        stats = compute_trek_stats(
            [
                {"latitude": 0, "longitude": 0, "altitude": 100, "time": base_time},
                {
                    "latitude": 0,
                    "longitude": 0.001,
                    "altitude": 100,
                    "time": base_time + timedelta(minutes=1),
                },
            ]
        )
        assert stats["difficulty_rating"] == "Easy"

    def test_null_altitude_handled(self):
        base_time = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        stats = compute_trek_stats(
            [
                {"latitude": 0, "longitude": 0, "altitude": None, "time": base_time},
                {
                    "latitude": 0,
                    "longitude": 0.001,
                    "altitude": None,
                    "time": base_time + timedelta(minutes=1),
                },
            ]
        )
        assert stats["distance_2d"] > 0
        assert stats["max_altitude"] is None
