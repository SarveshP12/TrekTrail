import uuid
from datetime import datetime
from typing import Optional

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class TrekSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "trek_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    activity_type: Mapped[str] = mapped_column(
        String(30), default="TREKKING", nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    # Computed stats (populated on session end)
    distance_2d: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    distance_3d: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    elevation_gain: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    elevation_loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_altitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    min_altitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calories_burned: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    difficulty_rating: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    avg_speed: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_pace: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relationships
    user = relationship("User", back_populates="trek_sessions")
    waypoints = relationship("Waypoint", back_populates="session", lazy="selectin")
