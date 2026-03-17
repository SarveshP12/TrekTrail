import uuid
from typing import Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class GroupSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "group_sessions"

    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    join_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    # Relationships
    creator = relationship("User", back_populates="created_groups")
    members = relationship("GroupMember", back_populates="group", lazy="selectin")