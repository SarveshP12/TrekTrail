from uuid import UUID

from app.api.deps import get_current_user
from app.database import get_db
from app.exceptions import ForbiddenException
from app.models.user import User
from app.schemas.user import UserRead, UserUpdate
from app.services.user_service import get_user_by_id, update_user
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/profile", response_model=UserRead)
async def get_profile(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_user_by_id(db, user_id)


@router.put("/{user_id}/profile", response_model=UserRead)
async def update_profile(
    user_id: UUID,
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != user_id:
        raise ForbiddenException("You can only update your own profile")
    return await update_user(db, user_id, data)
