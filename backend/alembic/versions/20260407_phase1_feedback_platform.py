"""phase1 feedback platform foundation

Revision ID: 20260407_phase1
Revises: 
Create Date: 2026-04-07 12:55:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260407_phase1"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("slug", sa.String(length=150), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)
    op.create_index("ix_organizations_name", "organizations", ["name"], unique=False)

    op.create_table(
        "respondents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=150), nullable=False),
        sa.Column("role", sa.String(length=100), nullable=False),
        sa.Column("company", sa.String(length=150), nullable=False),
        sa.Column("preferred_language", sa.String(length=20), server_default="en", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_respondents_email", "respondents", ["email"], unique=False)
    op.create_index("ix_respondents_company", "respondents", ["company"], unique=False)
    op.create_index("ix_respondents_role", "respondents", ["role"], unique=False)

    op.create_table(
        "feedback_submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.String(length=36), nullable=False),
        sa.Column("respondent_id", sa.Integer(), sa.ForeignKey("respondents.id"), nullable=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=True),
        sa.Column("tools_used", sa.Text(), nullable=False),
        sa.Column("pain_points", sa.Text(), nullable=False),
        sa.Column("new_tool", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="received", nullable=False),
        sa.Column("priority", sa.String(length=20), server_default="normal", nullable=False),
        sa.Column("tags", sa.Text(), nullable=True),
        sa.Column("owner", sa.String(length=150), nullable=True),
        sa.Column("source_channel", sa.String(length=50), server_default="web", nullable=False),
        sa.Column("language", sa.String(length=20), server_default="en", nullable=False),
        sa.Column("consent_to_store", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_anonymous", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_feedback_submissions_submission_id", "feedback_submissions", ["submission_id"], unique=True)
    op.create_index("ix_feedback_submissions_status", "feedback_submissions", ["status"], unique=False)
    op.create_index("ix_feedback_submissions_priority", "feedback_submissions", ["priority"], unique=False)
    op.create_index("ix_feedback_submissions_source_channel", "feedback_submissions", ["source_channel"], unique=False)
    op.create_index("ix_feedback_submissions_language", "feedback_submissions", ["language"], unique=False)
    op.create_index("ix_feedback_submissions_is_anonymous", "feedback_submissions", ["is_anonymous"], unique=False)

    op.create_table(
        "feedback_analysis",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("feedback_submissions.id"), nullable=False),
        sa.Column("model_version", sa.String(length=100), server_default="rules-v1", nullable=False),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("sentiment_label", sa.String(length=20), nullable=True),
        sa.Column("sentiment_score", sa.Float(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("processing_status", sa.String(length=30), server_default="completed", nullable=False),
        sa.Column("needs_human_review", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_feedback_analysis_category", "feedback_analysis", ["category"], unique=False)
    op.create_index("ix_feedback_analysis_processing_status", "feedback_analysis", ["processing_status"], unique=False)
    op.create_index("ix_feedback_analysis_sentiment_label", "feedback_analysis", ["sentiment_label"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_feedback_analysis_sentiment_label", table_name="feedback_analysis")
    op.drop_index("ix_feedback_analysis_processing_status", table_name="feedback_analysis")
    op.drop_index("ix_feedback_analysis_category", table_name="feedback_analysis")
    op.drop_table("feedback_analysis")

    op.drop_index("ix_feedback_submissions_is_anonymous", table_name="feedback_submissions")
    op.drop_index("ix_feedback_submissions_language", table_name="feedback_submissions")
    op.drop_index("ix_feedback_submissions_source_channel", table_name="feedback_submissions")
    op.drop_index("ix_feedback_submissions_priority", table_name="feedback_submissions")
    op.drop_index("ix_feedback_submissions_status", table_name="feedback_submissions")
    op.drop_index("ix_feedback_submissions_submission_id", table_name="feedback_submissions")
    op.drop_table("feedback_submissions")

    op.drop_index("ix_respondents_role", table_name="respondents")
    op.drop_index("ix_respondents_company", table_name="respondents")
    op.drop_index("ix_respondents_email", table_name="respondents")
    op.drop_table("respondents")

    op.drop_index("ix_organizations_name", table_name="organizations")
    op.drop_index("ix_organizations_slug", table_name="organizations")
    op.drop_table("organizations")
