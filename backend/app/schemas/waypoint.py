from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class WaypointCreate(BaseModel):
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    label: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None


class WaypointRead(BaseModel):
    id: UUID
    session_id: UUID
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    label: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
