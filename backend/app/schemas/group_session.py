from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GroupSessionCreate(BaseModel):
    name: str


class GroupSessionRead(BaseModel):
    id: UUID
    creator_id: UUID
    name: str
    join_code: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GroupMemberRead(BaseModel):
    id: UUID
    group_id: UUID
    user_id: UUID
    role: str
    joined_at: datetime

    model_config = {"from_attributes": True}
