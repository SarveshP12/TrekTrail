from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.config import settings
from app.database import engine, ts_engine
from app.redis_client import close_redis, get_redis
from app.schemas.common import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — nothing extra needed, engines/redis are lazy
    yield
    # Shutdown — clean up connections
    await engine.dispose()
    await ts_engine.dispose()
    await close_redis()


app = FastAPI(
    title="TrekTrack AI API",
    version="0.1.0",
    description="Backend API for TrekTrack AI trek tracking system",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routers
app.include_router(api_router)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    db_status = "healthy"
    ts_status = "healthy"
    redis_status = "healthy"

    # Check primary DB
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    # Check TimescaleDB
    try:
        async with ts_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        ts_status = "unhealthy"

    # Check Redis
    try:
        redis = await get_redis()
        await redis.ping()
    except Exception:
        redis_status = "unhealthy"

    overall = "healthy" if all(
        s == "healthy" for s in [db_status, ts_status, redis_status]
    ) else "degraded"

    return HealthResponse(
        status=overall,
        version="0.1.0",
        database=db_status,
        timescaledb=ts_status,
        redis=redis_status,
    )
