from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db, get_ts_db
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.gps_point import GPSPointBatchUpload, GPSPointRead
from app.schemas.trek_session import (
    TrekSessionCreate,
    TrekSessionRead,
    TrekSessionSummary,
)
from app.services.export_service import generate_gpx, generate_kml
from app.services.gps_service import get_session_points, store_gps_points
from app.services.session_service import (
    end_session,
    get_session,
    get_user_history,
    start_session,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/start", response_model=TrekSessionRead, status_code=201)
async def create_session(
    data: TrekSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await start_session(db, current_user.id, data.activity_type)
    return session


@router.post("/{session_id}/points", status_code=202)
async def upload_points(
    session_id: UUID,
    data: GPSPointBatchUpload,
    current_user: User = Depends(get_current_user),
    ts_db: AsyncSession = Depends(get_ts_db),
):
    await store_gps_points(ts_db, session_id, data.points)
    return {"accepted": len(data.points)}


@router.post("/{session_id}/end", response_model=TrekSessionRead)
async def finish_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ts_db: AsyncSession = Depends(get_ts_db),
):
    return await end_session(db, ts_db, session_id, current_user.id)


@router.get("/{session_id}/summary", response_model=TrekSessionRead)
async def get_summary(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_session(db, session_id)


@router.get("/{session_id}/track")
async def get_track(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    ts_db: AsyncSession = Depends(get_ts_db),
):
    points = await get_session_points(ts_db, session_id)
    # Return as GeoJSON
    features = []
    for pt in points:
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        pt["longitude"],
                        pt["latitude"],
                        pt.get("altitude"),
                    ],
                },
                "properties": {
                    "time": pt["time"].isoformat(),
                    "speed": pt.get("speed"),
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


@router.get("/{session_id}/export")
async def export_track(
    session_id: UUID,
    format: str = Query("gpx", pattern="^(gpx|kml)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ts_db: AsyncSession = Depends(get_ts_db),
):
    session = await get_session(db, session_id)
    points = await get_session_points(ts_db, session_id)
    name = f"TrekTrack_{session.start_time.strftime('%Y%m%d_%H%M')}"

    if format == "gpx":
        content = generate_gpx(name, points)
        media_type = "application/gpx+xml"
        filename = f"{name}.gpx"
    else:
        content = generate_kml(name, points)
        media_type = "application/vnd.google-earth.kml+xml"
        filename = f"{name}.kml"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/user/{user_id}/history")
async def get_history(
    user_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sessions, total = await get_user_history(db, user_id, page, page_size)
    return PaginatedResponse(
        items=[TrekSessionSummary.model_validate(s) for s in sessions],
        total=total,
        page=page,
        page_size=page_size,
        has_next=(page * page_size) < total,
    )
