from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class GroupSessionCreate(BaseModel):
    name: str
    join_code: str


class GroupSessionRead(BaseModel):
    id: UUID
    creator_id: UUID
    name: str
    join_code: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
