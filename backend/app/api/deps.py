from uuid import UUID

from fastapi import Depends, Header

from app.database import get_db
from app.exceptions import UnauthorizedException
from app.services.auth_service import decode_access_token
from app.services.user_service import get_user_by_id


async def get_current_user(
    authorization: str = Header(..., description="Bearer <token>"),
    db=Depends(get_db),
):
    if not authorization.startswith("Bearer "):
        raise UnauthorizedException("Invalid authorization header format")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = decode_access_token(token)
        user_id = UUID(payload["sub"])
    except Exception:
        raise UnauthorizedException()

    return await get_user_by_id(db, user_id)
