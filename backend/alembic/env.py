import asyncio
import os
import sys
from logging.config import fileConfig

# Ensure the backend directory is on sys.path for module resolution
abs_path = os.path.abspath(__file__)
root = os.path.dirname(os.path.dirname(abs_path))
if root not in sys.path:
    sys.path.insert(0, root)

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.models.base import Base
# Import all models so Alembic sees them
from app.models import (
    user,
    trek_session,
    waypoint,
    group_session,
    group_member,
)  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
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
