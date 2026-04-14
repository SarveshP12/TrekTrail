import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gps_point import GPSTrackPoint
from app.schemas.gps_point import GPSPointCreate

logger = logging.getLogger(__name__)


async def store_gps_points(db: AsyncSession, session_id: UUID, points: list[GPSPointCreate]) -> int:
    """Store a batch of GPS track points in TimescaleDB.

    Uses INSERT ... ON CONFLICT DO NOTHING to handle duplicate (time, session_id)
    pairs idempotently. This is necessary because:
      - Mobile GPS can produce multiple readings with the same millisecond timestamp
      - The BatchUploader retries failed batches, which may include already-inserted points
    """
    if not points:
        return 0

    # Deduplicate within the batch: keep last point for each (time, session_id)
    seen: dict[str, dict] = {}
    for pt in points:
        key = f"{pt.time.isoformat()}_{session_id}"
        seen[key] = {
            "time": pt.time,
            "session_id": session_id,
            "latitude": pt.latitude,
            "longitude": pt.longitude,
            "altitude": pt.altitude,
            "accuracy": pt.accuracy,
            "speed": pt.speed,
            "bearing": pt.bearing,
            "is_filtered": False,
            "filter_latitude": None,
            "filter_longitude": None,
            "filter_altitude": None,
        }

    rows = list(seen.values())

    stmt = (
        pg_insert(GPSTrackPoint)
        .values(rows)
        .on_conflict_do_nothing(index_elements=["time", "session_id"])
    )
    await db.execute(stmt)
    await db.flush()

    inserted = len(rows)
    if inserted < len(points):
        logger.info(
            "Deduplicated %d → %d points for session %s",
            len(points),
            inserted,
            session_id,
        )
    return inserted


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
