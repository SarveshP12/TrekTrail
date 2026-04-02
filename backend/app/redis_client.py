from app.config import settings
from redis.asyncio import Redis

redis_pool: Redis | None = None


async def get_redis() -> Redis:
    """FastAPI dependency: returns the Redis client."""
    global redis_pool
    if redis_pool is None:
        redis_pool = Redis.from_url(settings.redis_url, decode_responses=True)
    return redis_pool


async def close_redis() -> None:
    global redis_pool
    if redis_pool is not None:
        await redis_pool.close()
        redis_pool = None
