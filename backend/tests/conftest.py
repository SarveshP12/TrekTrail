import uuid
from typing import AsyncGenerator

import pytest_asyncio
from app.database import get_db, get_ts_db
from app.main import app
from app.models.base import Base
from app.services.auth_service import create_access_token, hash_password
from httpx import ASGITransport, AsyncClient
from sqlalchemy import StaticPool
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ---------------------------------------------------------------------------
# SQLite ↔ PostgreSQL type compatibility
# ---------------------------------------------------------------------------
# SQLAlchemy's PostgreSQL-specific types (UUID, JSONB) don't compile to SQLite.
# We register custom compilers so that Base.metadata.create_all works with SQLite.
from sqlalchemy.ext.compiler import compiles


@compiles(PG_UUID, "sqlite")
def compile_pg_uuid_sqlite(type_, compiler, **kw):
    """Render PostgreSQL UUID as CHAR(32) in SQLite."""
    return "CHAR(32)"


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    """Render PostgreSQL JSONB as TEXT in SQLite."""
    return "TEXT"


# ---------------------------------------------------------------------------
# Test engine and session
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "sqlite+aiosqlite://"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def override_get_ts_db() -> AsyncGenerator[AsyncSession, None]:
    """For tests, TimescaleDB queries go to the same test SQLite DB."""
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# Override FastAPI dependencies
app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_ts_db] = override_get_ts_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    """Create a test user and return (user, token)."""
    from app.models.user import User

    user = User(
        id=uuid.uuid4(),
        email="trekker@test.com",
        display_name="Test Trekker",
        password_hash=hash_password("testpassword123"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_access_token(str(user.id))
    return user, token


@pytest_asyncio.fixture
async def auth_headers(test_user):
    """Return authorization headers for the test user."""
    _, token = test_user
    return {"Authorization": f"Bearer {token}"}
