"""timescaledb hypertable

Revision ID: bbbbbbbbbbbb
Revises: aaaaaaaaaaaa
Create Date: 2026-03-14 10:05:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "bbbbbbbbbbbb"
down_revision: Union[str, None] = "aaaaaaaaaaaa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
    # Note: Requires timescaledb extension to be installed and loaded
    # Errors if not present, which is correct (migration should fail)
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
