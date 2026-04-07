from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(150), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    respondents: Mapped[list[Respondent]] = relationship("Respondent", back_populates="organization")
    submissions: Mapped[list[FeedbackSubmission]] = relationship("FeedbackSubmission", back_populates="organization")


class Respondent(Base):
    __tablename__ = "respondents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    company: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    preferred_language: Mapped[str] = mapped_column(String(20), nullable=False, default="en", server_default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped[Organization | None] = relationship("Organization", back_populates="respondents")
    submissions: Mapped[list[FeedbackSubmission]] = relationship("FeedbackSubmission", back_populates="respondent")


class FeedbackSubmission(Base):
    __tablename__ = "feedback_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[str] = mapped_column(
        String(36), nullable=False, unique=True, index=True, default=lambda: str(uuid4())
    )
    respondent_id: Mapped[int | None] = mapped_column(ForeignKey("respondents.id"), nullable=True, index=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)

    tools_used: Mapped[str] = mapped_column(Text, nullable=False)
    pain_points: Mapped[str] = mapped_column(Text, nullable=False)
    new_tool: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="received", server_default="received", index=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="normal", server_default="normal", index=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)

    source_channel: Mapped[str] = mapped_column(String(50), nullable=False, default="web", server_default="web", index=True)
    language: Mapped[str] = mapped_column(String(20), nullable=False, default="en", server_default="en", index=True)
    consent_to_store: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0", index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    respondent: Mapped[Respondent | None] = relationship("Respondent", back_populates="submissions")
    organization: Mapped[Organization | None] = relationship("Organization", back_populates="submissions")
    analyses: Mapped[list[FeedbackAnalysis]] = relationship("FeedbackAnalysis", back_populates="submission")


class FeedbackAnalysis(Base):
    __tablename__ = "feedback_analysis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("feedback_submissions.id"), nullable=False, index=True)

    model_version: Mapped[str] = mapped_column(String(100), nullable=False, default="rules-v1", server_default="rules-v1")
    category: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    sentiment_label: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    sentiment_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="completed", server_default="completed", index=True
    )
    needs_human_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    submission: Mapped[FeedbackSubmission] = relationship("FeedbackSubmission", back_populates="analyses")


class VisitorEvent(Base):
    __tablename__ = "visitor_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_name: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    path: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    referrer: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
