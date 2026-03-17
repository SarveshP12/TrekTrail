from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class GPSPointCreate(BaseModel):
    time: datetime
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    altitude: Optional[float] = None
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    bearing: Optional[float] = None


class GPSPointBatchUpload(BaseModel):
    session_id: UUID
    points: list[GPSPointCreate]


class GPSPointRead(BaseModel):
    time: datetime
    session_id: UUID
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    speed: Optional[float] = None
    is_filtered: bool
    filter_latitude: Optional[float] = None
    filter_longitude: Optional[float] = None

    model_config = {"from_attributes": True}