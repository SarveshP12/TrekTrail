from collections.abc import AsyncGenerator

from app.config import settings
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

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
