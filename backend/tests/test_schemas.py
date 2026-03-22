import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate
from app.schemas.gps_point import GPSPointCreate


def test_user_create_valid():
    user = UserCreate(email="test@example.com", display_name="Hiker", password="securepass123")
    assert user.email == "test@example.com"
    assert user.display_name == "Hiker"


def test_user_create_invalid_email():
    with pytest.raises(ValidationError):
        UserCreate(email="not-an-email", display_name="Hiker", password="securepass123")


def test_user_create_short_password():
    with pytest.raises(ValidationError):
        UserCreate(email="test@example.com", display_name="Hiker", password="short")


def test_gps_point_valid():
    point = GPSPointCreate(time="2025-03-15T10:30:00Z", latitude=18.5204, longitude=73.8567)
    assert point.latitude == 18.5204
    assert point.longitude == 73.8567


def test_gps_point_invalid_latitude():
    with pytest.raises(ValidationError):
        GPSPointCreate(time="2025-03-15T10:30:00Z", latitude=91.0, longitude=73.8567)


def test_gps_point_invalid_longitude():
    with pytest.raises(ValidationError):
        GPSPointCreate(time="2025-03-15T10:30:00Z", latitude=18.5204, longitude=181.0)