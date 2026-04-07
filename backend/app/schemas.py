from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class FeedbackBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    company: str
    tools_used: str
    pain_points: str
    new_tool: str
    source_channel: str = "web"
    language: str = "en"
    consent_to_store: bool = True
    is_anonymous: bool = False


class FeedbackCreate(FeedbackBase):
    pass


class RespondentResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    company: str
    preferred_language: str

    model_config = ConfigDict(from_attributes=True)


class FeedbackAnalysisResponse(BaseModel):
    id: int
    model_version: str
    category: str | None = None
    confidence_score: float | None = None
    sentiment_label: str | None = None
    sentiment_score: float | None = None
    summary: str | None = None
    processing_status: str
    needs_human_review: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FeedbackResponse(BaseModel):
    id: int
    submission_id: str
    status: str
    priority: str
    tags: str | None = None
    owner: str | None = None
    source_channel: str
    language: str
    consent_to_store: bool
    is_anonymous: bool
    tools_used: str
    pain_points: str
    new_tool: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None
    respondent: RespondentResponse | None = None
    latest_analysis: FeedbackAnalysisResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class TrackingEvent(BaseModel):
    event_name: str = Field(default="page_view")
    path: str | None = None
    referrer: str | None = None


class CategoryCount(BaseModel):
    label: str
    count: int


class DailyCount(BaseModel):
    date: str
    count: int


class AnalyticsResponse(BaseModel):
    total_responses: int
    page_views: int
    submissions: int
    conversion_rate: float
    unique_companies: int
    unique_roles: int
    top_issues: list[CategoryCount]
    daily_visits: list[DailyCount]
    latest_submission: str | None = None


class SearchRequest(BaseModel):
    query: str
    k: int = 5


class SearchHit(BaseModel):
    id: int
    submission_id: str | None = None
    score: float
    category: str | None = None
    summary: str | None = None
    snippet: str
    created_at: datetime
    name: str | None = None
    role: str | None = None
    company: str | None = None


class SearchResponse(BaseModel):
    answer: str
    matches: list[SearchHit]


class InsightResponse(BaseModel):
    summary: str
    recommendations: list[str]
    top_categories: list[CategoryCount]
    sample_highlights: list[str]
