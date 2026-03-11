# Phase 2: Database Design and Backend Foundations

## Phase Title

**Database Design and Backend Foundations**

---

## Objective

Design and implement the complete database schema across PostgreSQL (user data, trek metadata) and TimescaleDB (GPS time-series), set up Alembic migrations, establish the SQLAlchemy async ORM layer, configure Redis caching, and build the foundational backend patterns (dependency injection, error handling, request/response models). After this phase, the database is fully schema'd, migrations run cleanly, and the backend has a robust data access layer ready for feature development.

---

## Features Implemented in This Phase

- PostgreSQL schema: users, trek sessions, waypoints, group sessions, subscriptions
- TimescaleDB hypertable: GPS track points (time-series optimized)
- Redis configuration for caching and session token storage
- Alembic migration pipeline with auto-generation support
- SQLAlchemy 2.0 async ORM models with relationships
- Pydantic request/response schemas for all entities
- Database session dependency injection for FastAPI
- Centralized error handling middleware
- Health check endpoint enhanced with DB and Redis connectivity status

---

## Tasks Breakdown

* Task 1: Design the full Entity-Relationship Diagram (ERD) covering all tables
* Task 2: Create SQLAlchemy async models for the `users` table
* Task 3: Create SQLAlchemy async models for `trek_sessions` and `waypoints`
* Task 4: Create SQLAlchemy async models for `group_sessions` and `group_members`
* Task 5: Create the TimescaleDB hypertable model for `gps_track_points`
* Task 6: Configure Alembic for async PostgreSQL and generate the initial migration
* Task 7: Write a separate migration script for TimescaleDB hypertable creation
* Task 8: Implement the async database session factory and FastAPI dependency
* Task 9: Implement the Redis connection pool and FastAPI dependency
* Task 10: Define Pydantic schemas (request/response) for all entities
* Task 11: Build centralized exception handlers and error response models
* Task 12: Enhance the `/health` endpoint to check DB and Redis connectivity
* Task 13: Write unit tests for models, schemas, and database connectivity

---

## File Structure for This Phase

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                          # Updated: error handlers, health check w/ DB
│   ├── config.py                        # Settings (no changes)
│   ├── database.py                      # Async engine, session factory, dependency
│   ├── redis_client.py                  # Redis connection pool and dependency
│   ├── exceptions.py                    # Custom exception classes
│   ├── models/
│   │   ├── __init__.py                  # Re-export all models
│   │   ├── base.py                      # SQLAlchemy declarative base + mixins
│   │   ├── user.py                      # User model
│   │   ├── trek_session.py              # TrekSession model
│   │   ├── waypoint.py                  # Waypoint model
│   │   ├── gps_point.py                 # GPSTrackPoint model (TimescaleDB)
│   │   ├── group_session.py             # GroupSession model
│   │   └── group_member.py              # GroupMember model
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── common.py                    # Shared schemas (pagination, error response)
│   │   ├── user.py                      # User create/read/update schemas
│   │   ├── trek_session.py              # TrekSession schemas
│   │   ├── waypoint.py                  # Waypoint schemas
│   │   ├── gps_point.py                 # GPSTrackPoint schemas
│   │   └── group_session.py             # GroupSession schemas
│   └── api/                             # Empty (populated in Phase 3)
│       └── __init__.py
├── alembic/
│   ├── versions/
│   │   ├── 001_initial_schema.py        # Auto-generated: users, sessions, waypoints, groups
│   │   └── 002_timescaledb_hypertable.py # Manual: GPS hypertable
│   ├── env.py                           # Updated for async
│   └── script.mako
├── alembic.ini                          # Updated with DATABASE_URL
├── tests/
│   ├── conftest.py                      # Test fixtures: async DB session, test client
│   ├── test_health.py                   # Updated health check test
│   ├── test_models.py                   # Model creation tests
│   └── test_schemas.py                  # Schema validation tests
├── pyproject.toml
├── requirements.txt
└── Dockerfile
```

---

## Implementation Guide

### Task 1 — Entity-Relationship Design

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│    users     │       │  trek_sessions   │       │   waypoints  │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (UUID PK) │──1:N──│ id (UUID PK)     │──1:N──│ id (UUID PK) │
│ email        │       │ user_id (FK)     │       │ session_id   │
│ display_name │       │ start_time       │       │ latitude     │
│ password_hash│       │ end_time         │       │ longitude    │
│ avatar_url   │       │ activity_type    │       │ altitude     │
│ preferences  │       │ distance_2d      │       │ label        │
│ subscription │       │ distance_3d      │       │ photo_url    │
│ created_at   │       │ elevation_gain   │       │ created_at   │
│ updated_at   │       │ elevation_loss   │       └──────────────┘
└──────────────┘       │ max_altitude     │
        │              │ duration_seconds │
        │              │ calories_burned  │
        │              │ difficulty_rating│
        │              │ status           │
        │              │ created_at       │
        │              └──────────────────┘
        │
        │              ┌──────────────────┐       ┌────────────────┐
        └──1:N─────────│ group_sessions   │──1:N──│ group_members  │
                       ├──────────────────┤       ├────────────────┤
                       │ id (UUID PK)     │       │ id (UUID PK)   │
                       │ creator_id (FK)  │       │ group_id (FK)  │
                       │ name             │       │ user_id (FK)   │
                       │ join_code        │       │ joined_at      │
                       │ status           │       │ role           │
                       │ created_at       │       └────────────────┘
                       └──────────────────┘

TimescaleDB (separate database):
┌─────────────────────────────┐
│     gps_track_points        │  ← Hypertable partitioned by time
├─────────────────────────────┤
│ time (TIMESTAMPTZ PK)       │
│ session_id (UUID)           │
│ latitude (DOUBLE)           │
│ longitude (DOUBLE)          │
│ altitude (DOUBLE)           │
│ accuracy (FLOAT)            │
│ speed (FLOAT)               │
│ bearing (FLOAT)             │
│ is_filtered (BOOLEAN)       │
│ filter_latitude (DOUBLE)    │
│ filter_longitude (DOUBLE)   │
│ filter_altitude (DOUBLE)    │
└─────────────────────────────┘
```

### Task 2 — SQLAlchemy Base and User Model

`backend/app/models/base.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
```

`backend/app/models/user.py`:

```python
import uuid
from typing import Optional

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    preferences: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=dict)
    subscription_tier: Mapped[str] = mapped_column(String(20), default="free", nullable=False)

    # Relationships
    trek_sessions = relationship("TrekSession", back_populates="user", lazy="selectin")
    created_groups = relationship("GroupSession", back_populates="creator", lazy="selectin")
```

### Task 3 — TrekSession and Waypoint Models

`backend/app/models/trek_session.py`:

```python
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class TrekSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "trek_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    activity_type: Mapped[str] = mapped_column(String(30), default="TREKKING", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    # Computed stats (populated on session end)
    distance_2d: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    distance_3d: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    elevation_gain: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    elevation_loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_altitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    min_altitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calories_burned: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    difficulty_rating: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    avg_speed: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_pace: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relationships
    user = relationship("User", back_populates="trek_sessions")
    waypoints = relationship("Waypoint", back_populates="session", lazy="selectin")
```

`backend/app/models/waypoint.py`:

```python
import uuid
from typing import Optional

from sqlalchemy import Float, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Waypoint(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "waypoints"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    altitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    session = relationship("TrekSession", back_populates="waypoints")
```

### Task 4 — GroupSession and GroupMember Models

`backend/app/models/group_session.py`:

```python
import uuid
from typing import Optional

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class GroupSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "group_sessions"

    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    join_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    # Relationships
    creator = relationship("User", back_populates="created_groups")
    members = relationship("GroupMember", back_populates="group", lazy="selectin")
```

`backend/app/models/group_member.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class GroupMember(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "group_members"

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), default="member", nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    group = relationship("GroupSession", back_populates="members")
```

### Task 5 — GPS Track Points (TimescaleDB Hypertable)

`backend/app/models/gps_point.py`:

```python
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GPSTrackPoint(Base):
    __tablename__ = "gps_track_points"

    time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, nullable=False
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    altitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speed: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bearing: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_filtered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    filter_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    filter_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    filter_altitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    __table_args__ = (
        Index("idx_gps_session_time", "session_id", "time"),
    )
```

### Task 6 — Async Database Setup and Alembic

`backend/app/database.py`:

```python
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

# Primary PostgreSQL engine
engine = create_async_engine(settings.database_url, echo=settings.debug, pool_size=20)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# TimescaleDB engine
ts_engine = create_async_engine(settings.timescale_url, echo=settings.debug, pool_size=20)
ts_session_factory = async_sessionmaker(ts_engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields a primary DB session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_ts_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields a TimescaleDB session."""
    async with ts_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

Update `backend/alembic/env.py` for async:

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.models.base import Base
# Import all models so Alembic sees them
from app.models import user, trek_session, waypoint, group_session, group_member  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=settings.database_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(settings.database_url)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

Generate migration:

```bash
cd backend
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

### Task 7 — TimescaleDB Hypertable Migration

`backend/alembic/versions/002_timescaledb_hypertable.py` (manual):

```python
"""Create TimescaleDB hypertable for GPS track points.

This migration runs against the TimescaleDB instance.
"""

from alembic import op


def upgrade() -> None:
    # Create the table first (if not auto-created)
    op.execute("""
        CREATE TABLE IF NOT EXISTS gps_track_points (
            time TIMESTAMPTZ NOT NULL,
            session_id UUID NOT NULL,
            latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL,
            altitude DOUBLE PRECISION,
            accuracy REAL,
            speed REAL,
            bearing REAL,
            is_filtered BOOLEAN NOT NULL DEFAULT FALSE,
            filter_latitude DOUBLE PRECISION,
            filter_longitude DOUBLE PRECISION,
            filter_altitude DOUBLE PRECISION,
            PRIMARY KEY (time, session_id)
        );
    """)

    # Convert to hypertable
    op.execute("""
        SELECT create_hypertable('gps_track_points', 'time',
            chunk_time_interval => INTERVAL '1 day',
            if_not_exists => TRUE
        );
    """)

    # Create index for session-based queries
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_gps_session_time
        ON gps_track_points (session_id, time DESC);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS gps_track_points;")
```

### Task 9 — Redis Client

`backend/app/redis_client.py`:

```python
from redis.asyncio import Redis

from app.config import settings

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
```

### Task 10 — Pydantic Schemas

`backend/app/schemas/common.py`:

```python
from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel

T = TypeVar("T")


class ErrorResponse(BaseModel):
    detail: str
    error_code: str | None = None


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    has_next: bool


class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    timescaledb: str
    redis: str
```

`backend/app/schemas/user.py`:

```python
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    display_name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)


class UserRead(BaseModel):
    id: UUID
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    subscription_tier: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=2, max_length=100)
    avatar_url: Optional[str] = None
    preferences: Optional[dict] = None
```

`backend/app/schemas/trek_session.py`:

```python
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class TrekSessionCreate(BaseModel):
    activity_type: str = "TREKKING"


class TrekSessionRead(BaseModel):
    id: UUID
    user_id: UUID
    start_time: datetime
    end_time: Optional[datetime] = None
    activity_type: str
    status: str
    distance_2d: Optional[float] = None
    distance_3d: Optional[float] = None
    elevation_gain: Optional[float] = None
    elevation_loss: Optional[float] = None
    max_altitude: Optional[float] = None
    min_altitude: Optional[float] = None
    duration_seconds: Optional[int] = None
    calories_burned: Optional[int] = None
    difficulty_rating: Optional[str] = None
    avg_speed: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TrekSessionSummary(BaseModel):
    id: UUID
    activity_type: str
    start_time: datetime
    end_time: Optional[datetime] = None
    distance_3d: Optional[float] = None
    elevation_gain: Optional[float] = None
    duration_seconds: Optional[int] = None
    difficulty_rating: Optional[str] = None

    model_config = {"from_attributes": True}
```

`backend/app/schemas/gps_point.py`:

```python
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class GPSPointCreate(BaseModel):
    time: datetime
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    altitude: Optional[float] = None
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    bearing: Optional[float] = None


class GPSPointBatchUpload(BaseModel):
    session_id: UUID
    points: list[GPSPointCreate]


class GPSPointRead(BaseModel):
    time: datetime
    session_id: UUID
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    speed: Optional[float] = None
    is_filtered: bool
    filter_latitude: Optional[float] = None
    filter_longitude: Optional[float] = None

    model_config = {"from_attributes": True}
```

### Task 11 — Exception Handling

`backend/app/exceptions.py`:

```python
from fastapi import HTTPException, status


class NotFoundException(HTTPException):
    def __init__(self, entity: str = "Resource"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity} not found")


class ConflictException(HTTPException):
    def __init__(self, detail: str = "Resource already exists"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class UnauthorizedException(HTTPException):
    def __init__(self, detail: str = "Invalid or expired credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenException(HTTPException):
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
```

### Task 12 — Enhanced Health Check

Update `backend/app/main.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, ts_engine
from app.redis_client import close_redis, get_redis
from app.schemas.common import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
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


@app.get("/health", response_model=HealthResponse)
async def health_check():
    db_status = "healthy"
    ts_status = "healthy"
    redis_status = "healthy"

    # Check primary DB
    try:
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
    except Exception:
        db_status = "unhealthy"

    # Check TimescaleDB
    try:
        async with ts_engine.connect() as conn:
            await conn.execute("SELECT 1")
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
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `sqlalchemy[asyncio]` 2.0+ | Async ORM with PostgreSQL |
| `asyncpg` | Async PostgreSQL driver |
| `alembic` | Database migration management |
| `pydantic` 2.6+ | Request/response validation |
| `pydantic[email]` | Email validation in schemas |
| `redis[async]` 5.0+ | Async Redis client |
| `pytest-asyncio` | Async test support |
| `httpx` | Async test client for FastAPI |

Add to `backend/requirements.txt`:

```
pydantic[email]==2.6.1
```

---

## Expected Output

After completing this phase:

1. `alembic upgrade head` creates all tables in PostgreSQL: `users`, `trek_sessions`, `waypoints`, `group_sessions`, `group_members`.
2. The TimescaleDB migration creates the `gps_track_points` hypertable partitioned by day.
3. `GET /health` returns connectivity status for PostgreSQL, TimescaleDB, and Redis.
4. All Pydantic schemas validate correctly with proper field constraints.
5. The async session dependency yields properly scoped database sessions.
6. All unit tests pass.

---

## Testing Instructions

### 1. Run Migrations

```bash
# Ensure Docker services are up
cd infrastructure && docker compose up -d && cd ..

cd backend
source .venv/bin/activate

# Run primary DB migrations
alembic upgrade head

# Verify tables exist
docker exec -it infrastructure-postgres-1 psql -U postgres -d trektrack \
  -c "\dt"
#  users | trek_sessions | waypoints | group_sessions | group_members

# Run TimescaleDB migration manually
docker exec -it infrastructure-timescaledb-1 psql -U postgres -d trektrack_ts \
  -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
# Then run the hypertable SQL from the migration
```

### 2. Test Health Endpoint

```bash
uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/health

# Expected:
# {
#   "status": "healthy",
#   "version": "0.1.0",
#   "database": "healthy",
#   "timescaledb": "healthy",
#   "redis": "healthy"
# }
```

### 3. Test Schema Validation

```bash
pytest tests/test_schemas.py -v
```

Example test (`tests/test_schemas.py`):

```python
import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate
from app.schemas.gps_point import GPSPointCreate


def test_user_create_valid():
    user = UserCreate(email="test@example.com", display_name="Hiker", password="securepass123")
    assert user.email == "test@example.com"


def test_user_create_invalid_email():
    with pytest.raises(ValidationError):
        UserCreate(email="not-an-email", display_name="Hiker", password="securepass123")


def test_user_create_short_password():
    with pytest.raises(ValidationError):
        UserCreate(email="test@example.com", display_name="Hiker", password="short")


def test_gps_point_valid():
    point = GPSPointCreate(time="2025-03-15T10:30:00Z", latitude=18.5204, longitude=73.8567)
    assert point.latitude == 18.5204


def test_gps_point_invalid_latitude():
    with pytest.raises(ValidationError):
        GPSPointCreate(time="2025-03-15T10:30:00Z", latitude=91.0, longitude=73.8567)
```

### 4. Run Full Test Suite

```bash
cd backend
pytest tests/ -v --tb=short
```
