from datetime import datetime, timezone
from uuid import UUID

from app.exceptions import ForbiddenException, NotFoundException
from app.models.trek_session import TrekSession
from app.services.gps_service import get_session_points
from app.utils.distance import compute_trek_stats
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def start_session(
    db: AsyncSession, user_id: UUID, activity_type: str
) -> TrekSession:
    session = TrekSession(
        user_id=user_id,
        start_time=datetime.now(timezone.utc),
        activity_type=activity_type,
        status="active",
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


async def get_session(db: AsyncSession, session_id: UUID) -> TrekSession:
    result = await db.execute(select(TrekSession).where(TrekSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise NotFoundException("Trek session")
    return session


async def end_session(
    db: AsyncSession, ts_db: AsyncSession, session_id: UUID, user_id: UUID
) -> TrekSession:
    session = await get_session(db, session_id)
    if session.user_id != user_id:
        raise ForbiddenException("You can only end your own session")

    session.end_time = datetime.now(timezone.utc)
    session.status = "completed"

    # Ensure both are timezone-aware for duration calculation (SQLite fix)
    start = session.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    end = session.end_time
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    session.duration_seconds = int((end - start).total_seconds())

    # Compute stats from GPS points
    points = await get_session_points(ts_db, session_id)
    if points:
        stats = compute_trek_stats(points)
        session.distance_2d = stats["distance_2d"]
        session.distance_3d = stats["distance_3d"]
        session.elevation_gain = stats["elevation_gain"]
        session.elevation_loss = stats["elevation_loss"]
        session.max_altitude = stats["max_altitude"]
        session.min_altitude = stats["min_altitude"]
        session.calories_burned = stats["calories_burned"]
        session.difficulty_rating = stats["difficulty_rating"]
        session.avg_speed = stats["avg_speed"]

    await db.flush()
    await db.refresh(session)
    return session


async def get_user_history(
    db: AsyncSession, user_id: UUID, page: int = 1, page_size: int = 20
) -> tuple[list[TrekSession], int]:
    # Count total
    count_q = select(TrekSession).where(TrekSession.user_id == user_id)
    all_results = await db.execute(count_q)
    total = len(all_results.scalars().all())

    # Paginated query
    query = (
        select(TrekSession)
        .where(TrekSession.user_id == user_id)
        .order_by(TrekSession.start_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    sessions = result.scalars().all()
    return list(sessions), total
