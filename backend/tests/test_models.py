import uuid
from datetime import datetime, timezone

import pytest

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.user import User
from app.models.trek_session import TrekSession
from app.models.waypoint import Waypoint
from app.models.gps_point import GPSTrackPoint
from app.models.group_session import GroupSession
from app.models.group_member import GroupMember


# ---------------------------------------------------------------------------
# Base and Mixin Tests
# ---------------------------------------------------------------------------


class TestBase:
    """Verify the declarative base is correctly set up."""

    def test_base_has_metadata(self):
        assert Base.metadata is not None

    def test_base_metadata_has_tables(self):
        table_names = set(Base.metadata.tables.keys())
        expected = {
            "users",
            "trek_sessions",
            "waypoints",
            "group_sessions",
            "group_members",
            "gps_track_points",
        }
        assert expected.issubset(table_names)


# ---------------------------------------------------------------------------
# User Model Tests
# ---------------------------------------------------------------------------


class TestUserModel:
    """Verify User table schema and column constraints."""

    def test_tablename(self):
        assert User.__tablename__ == "users"

    def test_columns_exist(self):
        columns = {c.name for c in User.__table__.columns}
        expected = {
            "id",
            "email",
            "display_name",
            "password_hash",
            "avatar_url",
            "preferences",
            "subscription_tier",
            "created_at",
            "updated_at",
        }
        assert expected == columns

    def test_email_is_unique_and_indexed(self):
        col = User.__table__.c.email
        assert col.unique is True
        assert col.index is True

    def test_email_not_nullable(self):
        col = User.__table__.c.email
        assert col.nullable is False

    def test_subscription_tier_default(self):
        col = User.__table__.c.subscription_tier
        assert col.default is not None
        assert col.default.arg == "free"

    def test_primary_key_is_uuid(self):
        pk_cols = [c.name for c in User.__table__.primary_key.columns]
        assert pk_cols == ["id"]

    def test_relationships(self):
        rel_names = {r.key for r in User.__mapper__.relationships}
        assert "trek_sessions" in rel_names
        assert "created_groups" in rel_names


# ---------------------------------------------------------------------------
# TrekSession Model Tests
# ---------------------------------------------------------------------------


class TestTrekSessionModel:
    def test_tablename(self):
        assert TrekSession.__tablename__ == "trek_sessions"

    def test_columns_exist(self):
        columns = {c.name for c in TrekSession.__table__.columns}
        expected = {
            "id",
            "user_id",
            "start_time",
            "end_time",
            "activity_type",
            "status",
            "distance_2d",
            "distance_3d",
            "elevation_gain",
            "elevation_loss",
            "max_altitude",
            "min_altitude",
            "duration_seconds",
            "calories_burned",
            "difficulty_rating",
            "avg_speed",
            "avg_pace",
            "created_at",
            "updated_at",
        }
        assert expected == columns

    def test_user_id_indexed(self):
        col = TrekSession.__table__.c.user_id
        assert col.index is True

    def test_nullable_stats_columns(self):
        nullable_cols = [
            "distance_2d",
            "distance_3d",
            "elevation_gain",
            "elevation_loss",
            "max_altitude",
            "min_altitude",
            "duration_seconds",
            "calories_burned",
            "difficulty_rating",
            "avg_speed",
            "avg_pace",
            "end_time",
        ]
        for name in nullable_cols:
            col = TrekSession.__table__.c[name]
            assert col.nullable is True, f"{name} should be nullable"

    def test_activity_type_default(self):
        col = TrekSession.__table__.c.activity_type
        assert col.default.arg == "TREKKING"

    def test_relationships(self):
        rel_names = {r.key for r in TrekSession.__mapper__.relationships}
        assert "user" in rel_names
        assert "waypoints" in rel_names


# ---------------------------------------------------------------------------
# Waypoint Model Tests
# ---------------------------------------------------------------------------


class TestWaypointModel:
    def test_tablename(self):
        assert Waypoint.__tablename__ == "waypoints"

    def test_columns_exist(self):
        columns = {c.name for c in Waypoint.__table__.columns}
        expected = {
            "id",
            "session_id",
            "latitude",
            "longitude",
            "altitude",
            "label",
            "description",
            "photo_url",
            "created_at",
            "updated_at",
        }
        assert expected == columns

    def test_session_id_indexed(self):
        col = Waypoint.__table__.c.session_id
        assert col.index is True

    def test_lat_long_not_nullable(self):
        assert Waypoint.__table__.c.latitude.nullable is False
        assert Waypoint.__table__.c.longitude.nullable is False

    def test_relationships(self):
        rel_names = {r.key for r in Waypoint.__mapper__.relationships}
        assert "session" in rel_names


# ---------------------------------------------------------------------------
# GPSTrackPoint Model Tests
# ---------------------------------------------------------------------------


class TestGPSTrackPointModel:
    def test_tablename(self):
        assert GPSTrackPoint.__tablename__ == "gps_track_points"

    def test_columns_exist(self):
        columns = {c.name for c in GPSTrackPoint.__table__.columns}
        expected = {
            "time",
            "session_id",
            "latitude",
            "longitude",
            "altitude",
            "accuracy",
            "speed",
            "bearing",
            "is_filtered",
            "filter_latitude",
            "filter_longitude",
            "filter_altitude",
        }
        assert expected == columns

    def test_composite_primary_key(self):
        pk_cols = {c.name for c in GPSTrackPoint.__table__.primary_key.columns}
        assert pk_cols == {"time", "session_id"}

    def test_is_filtered_default(self):
        col = GPSTrackPoint.__table__.c.is_filtered
        assert col.default.arg is False

    def test_has_session_time_index(self):
        index_names = {idx.name for idx in GPSTrackPoint.__table__.indexes}
        assert "idx_gps_session_time" in index_names


# ---------------------------------------------------------------------------
# GroupSession Model Tests
# ---------------------------------------------------------------------------


class TestGroupSessionModel:
    def test_tablename(self):
        assert GroupSession.__tablename__ == "group_sessions"

    def test_columns_exist(self):
        columns = {c.name for c in GroupSession.__table__.columns}
        expected = {"id", "creator_id", "name", "join_code", "status", "created_at", "updated_at"}
        assert expected == columns

    def test_join_code_unique_and_indexed(self):
        col = GroupSession.__table__.c.join_code
        assert col.unique is True
        assert col.index is True

    def test_creator_id_indexed(self):
        col = GroupSession.__table__.c.creator_id
        assert col.index is True

    def test_relationships(self):
        rel_names = {r.key for r in GroupSession.__mapper__.relationships}
        assert "creator" in rel_names
        assert "members" in rel_names


# ---------------------------------------------------------------------------
# GroupMember Model Tests
# ---------------------------------------------------------------------------


class TestGroupMemberModel:
    def test_tablename(self):
        assert GroupMember.__tablename__ == "group_members"

    def test_columns_exist(self):
        columns = {c.name for c in GroupMember.__table__.columns}
        expected = {"id", "group_id", "user_id", "role", "joined_at"}
        assert expected == columns

    def test_group_id_indexed(self):
        col = GroupMember.__table__.c.group_id
        assert col.index is True

    def test_user_id_indexed(self):
        col = GroupMember.__table__.c.user_id
        assert col.index is True

    def test_role_default(self):
        col = GroupMember.__table__.c.role
        assert col.default.arg == "member"

    def test_relationships(self):
        rel_names = {r.key for r in GroupMember.__mapper__.relationships}
        assert "group" in rel_names
