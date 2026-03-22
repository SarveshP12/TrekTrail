from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.services.elevation_service import lookup_elevation

router = APIRouter(prefix="/elevation", tags=["elevation"])


@router.get("/lookup")
async def get_elevation(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    current_user=Depends(get_current_user),
):
    elevation = await lookup_elevation(lat, lng)
    return {"latitude": lat, "longitude": lng, "elevation": elevation}
