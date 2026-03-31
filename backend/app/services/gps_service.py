from uuid import UUID

from app.models.gps_point import GPSTrackPoint
from app.schemas.gps_point import GPSPointCreate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def store_gps_points(db: AsyncSession, session_id: UUID, points: list[GPSPointCreate]) -> int:
    """Store a batch of GPS track points in TimescaleDB."""
    for pt in points:
        track_point = GPSTrackPoint(
            time=pt.time,
            session_id=session_id,
            latitude=pt.latitude,
            longitude=pt.longitude,
            altitude=pt.altitude,
            accuracy=pt.accuracy,
            speed=pt.speed,
            bearing=pt.bearing,
            is_filtered=False,
        )
        db.add(track_point)
    await db.flush()
    return len(points)


async def get_session_points(db: AsyncSession, session_id: UUID) -> list[dict]:
    """Retrieve all GPS points for a session, ordered by time."""
    result = await db.execute(
        select(GPSTrackPoint)
        .where(GPSTrackPoint.session_id == session_id)
        .order_by(GPSTrackPoint.time.asc())
    )
    rows = result.scalars().all()
    return [
        {
            "time": row.time,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "altitude": row.altitude,
            "speed": row.speed,
            "accuracy": row.accuracy,
            "bearing": row.bearing,
        }
        for row in rows
    ]
