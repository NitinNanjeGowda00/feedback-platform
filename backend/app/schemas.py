from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field


class FeedbackBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    company: str
    tools_used: str
    pain_points: str
    new_tool: str


class FeedbackCreate(FeedbackBase):
    pass


class FeedbackResponse(FeedbackBase):
    id: int
    category: str | None = None
    sentiment_label: str | None = None
    sentiment_score: float | None = None
    summary: str | None = None
    created_at: datetime

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
    latest_submission: datetime | None = None


class SearchRequest(BaseModel):
    query: str
    k: int = 5


class SearchHit(BaseModel):
    id: int
    score: float
    category: str | None = None
    summary: str | None = None
    snippet: str
    created_at: datetime


class SearchResponse(BaseModel):
    answer: str
    matches: list[SearchHit]


class InsightResponse(BaseModel):
    summary: str
    recommendations: list[str]
    top_categories: list[CategoryCount]
    sample_highlights: list[str]