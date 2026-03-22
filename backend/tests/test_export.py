import pytest
from app.services.export_service import generate_gpx, generate_kml
from datetime import datetime, timezone


class TestGPXExport:
    def test_generates_valid_xml(self):
        points = [
            {
                "latitude": 28.6139,
                "longitude": 77.2090,
                "altitude": 216.0,
                "time": datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
            },
            {
                "latitude": 28.6140,
                "longitude": 77.2091,
                "altitude": 217.0,
                "time": datetime(2026, 1, 1, 10, 0, 1, tzinfo=timezone.utc),
            },
        ]
        result = generate_gpx("Test Trek", points)
        assert isinstance(result, bytes)
        assert b"<?xml" in result
        assert b"<gpx" in result
        assert b"<trk>" in result
        assert b"Test Trek" in result
        assert b"28.6139" in result

    def test_handles_null_altitude(self):
        points = [
            {
                "latitude": 28.6139,
                "longitude": 77.2090,
                "altitude": None,
                "time": datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
            },
        ]
        result = generate_gpx("No Alt Trek", points)
        assert b"<ele>" not in result

    def test_empty_points(self):
        result = generate_gpx("Empty Trek", [])
        assert b"<trkseg" in result


class TestKMLExport:
    def test_generates_valid_kml(self):
        points = [
            {
                "latitude": 28.6139,
                "longitude": 77.2090,
                "altitude": 216.0,
                "time": datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
            },
        ]
        result = generate_kml("Test Trek", points)
        assert isinstance(result, bytes)
        assert b"<?xml" in result
        assert b"<kml" in result
        assert b"<LineString>" in result
        assert b"Test Trek" in result

    def test_handles_null_altitude_defaults_to_zero(self):
        points = [
            {
                "latitude": 28.6139,
                "longitude": 77.2090,
                "altitude": None,
                "time": datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
            },
        ]
        result = generate_kml("Null Alt", points)
        assert b"77.209,28.6139,0" in result
