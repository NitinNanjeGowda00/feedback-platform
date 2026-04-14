"""add visitor events table

Revision ID: 20260407_visitor_events
Revises: 20260407_phase1
Create Date: 2026-04-07 19:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260407_visitor_events"
down_revision = "20260407_phase1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "visitor_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_name", sa.String(length=50), nullable=False),
        sa.Column("path", sa.String(length=255), nullable=True),
        sa.Column("referrer", sa.Text(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("ip_hash", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_visitor_events_event_name", "visitor_events", ["event_name"], unique=False)
    op.create_index("ix_visitor_events_path", "visitor_events", ["path"], unique=False)
    op.create_index("ix_visitor_events_ip_hash", "visitor_events", ["ip_hash"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_visitor_events_ip_hash", table_name="visitor_events")
    op.drop_index("ix_visitor_events_path", table_name="visitor_events")
    op.drop_index("ix_visitor_events_event_name", table_name="visitor_events")
    op.drop_table("visitor_events")
