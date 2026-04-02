import httpx

from app.config import settings
from app.redis_client import get_redis


async def lookup_elevation(latitude: float, longitude: float) -> float | None:
    """Look up elevation from OpenTopoData API with Redis caching."""
    cache_key = f"elev:{latitude:.5f}:{longitude:.5f}"

    redis = await get_redis()
    cached = await redis.get(cache_key)
    if cached is not None:
        return float(cached)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                settings.opentopodata_api_url,
                params={"locations": f"{latitude},{longitude}"},
            )
            resp.raise_for_status()
            data = resp.json()
            elevation = data["results"][0]["elevation"]
            if elevation is not None:
                await redis.setex(cache_key, 86400, str(elevation))  # Cache 24h
                return float(elevation)
    except Exception:
        pass
    return None
