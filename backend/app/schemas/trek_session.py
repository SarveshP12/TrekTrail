from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class TrekSessionCreate(BaseModel):
    activity_type: str = "TREKKING"


class TrekSessionRead(BaseModel):
    id: UUID
    user_id: UUID
    start_time: datetime
    end_time: Optional[datetime] = None
    activity_type: str
    status: str
    distance_2d: Optional[float] = None
    distance_3d: Optional[float] = None
    elevation_gain: Optional[float] = None
    elevation_loss: Optional[float] = None
    max_altitude: Optional[float] = None
    min_altitude: Optional[float] = None
    duration_seconds: Optional[int] = None
    calories_burned: Optional[int] = None
    difficulty_rating: Optional[str] = None
    avg_speed: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TrekSessionSummary(BaseModel):
    id: UUID
    activity_type: str
    start_time: datetime
    end_time: Optional[datetime] = None
    distance_3d: Optional[float] = None
    elevation_gain: Optional[float] = None
    duration_seconds: Optional[int] = None
    difficulty_rating: Optional[str] = None

    model_config = {"from_attributes": True}
