from __future__ import annotations


from dotenv import load_dotenv
load_dotenv()

import csv
import os
from datetime import datetime, timedelta
from io import StringIO
from app.database import Base, engine


from fastapi import BackgroundTasks
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import Date, cast, func, inspect, text
from sqlalchemy.orm import Session, joinedload

from .llm_service import LLMService
from .database import Base, IS_SQLITE, SessionLocal, engine
from .ml_service import IntelligenceEngine
from .models import FeedbackAnalysis, FeedbackSubmission, Organization, Respondent, VisitorEvent
from .schemas import (
    AnalyticsResponse,
    CategoryCount,
    FeedbackAnalysisResponse,
    FeedbackCreate,
    FeedbackResponse,
    InsightResponse,
    RespondentResponse,
    SearchRequest,
    SearchResponse,
    TrackingEvent,
)
from .security import (
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    get_client_ip,
    hash_ip,
    require_admin_api_key,
)
from .vector_service import FeedbackVectorStore

app = FastAPI(title="AI Feedback Intelligence API")
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "https://feedback-platform-neon.vercel.app,http://localhost:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

intelligence = IntelligenceEngine()
vector_store = FeedbackVectorStore()
llm_service = LLMService()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_feedback_query(db: Session):
    return (
        db.query(FeedbackSubmission)
        .options(
            joinedload(FeedbackSubmission.respondent),
            joinedload(FeedbackSubmission.analyses),
        )
        .order_by(FeedbackSubmission.created_at.desc())
    )


def serialize_feedback(submission: FeedbackSubmission) -> FeedbackResponse:
    latest_analysis = max(submission.analyses, key=lambda item: item.created_at) if submission.analyses else None
    submission.latest_analysis = latest_analysis
    respondent = submission.respondent

    return FeedbackResponse(
        id=submission.id,
        submission_id=submission.submission_id,
        status=submission.status,
        priority=submission.priority,
        tags=submission.tags,
        owner=submission.owner,
        source_channel=submission.source_channel,
        language=submission.language,
        consent_to_store=submission.consent_to_store,
        is_anonymous=submission.is_anonymous,
        tools_used=submission.tools_used,
        pain_points=submission.pain_points,
        new_tool=submission.new_tool,
        created_at=submission.created_at,
        updated_at=submission.updated_at,
        archived_at=submission.archived_at,
        respondent=RespondentResponse.model_validate(respondent) if respondent else None,
        latest_analysis=FeedbackAnalysisResponse.model_validate(latest_analysis) if latest_analysis else None,
    )


def refresh_vector_store(db: Session) -> None:
    rows = get_feedback_query(db).all()
    for row in rows:
        row.latest_analysis = max(row.analyses, key=lambda item: item.created_at) if row.analyses else None
    vector_store.rebuild(rows)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    ensure_phase1_tables()

    db = SessionLocal()
    try:
        if IS_SQLITE:
            migrate_legacy_feedback(db)
        refresh_vector_store(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "AI Feedback Intelligence API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/track")
def track_event(payload: TrackingEvent, request: Request, db: Session = Depends(get_db)):
    event = VisitorEvent(
        event_name=payload.event_name or "page_view",
        path=payload.path or request.url.path,
        referrer=payload.referrer or request.headers.get("referer"),
        user_agent=request.headers.get("user-agent"),
        ip_hash=hash_ip(get_client_ip(request)),
    )
    db.add(event)
    db.commit()
    return {"tracked": True}


@app.post("/feedback", response_model=FeedbackResponse)
def create_feedback(
    payload: FeedbackCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    combined_text = " ".join(
        part for part in [
            payload.tools_used,
            payload.pain_points,
            payload.new_tool,
            ]
        if part
        ).strip()

    category, confidence = intelligence.classify(combined_text)
    sentiment_label, sentiment_score = intelligence.sentiment(combined_text)
    summary = intelligence.summarize_feedback(combined_text)
    needs_human_review = confidence < 0.6

    organization = None
    company_name = payload.company.strip() or "Independent"
    slug = company_name.lower().replace(" ", "-")
    organization = db.query(Organization).filter(Organization.slug == slug).first()
    if organization is None:
        organization = Organization(name=company_name, slug=slug)
        db.add(organization)
        db.flush()

    respondent = Respondent(
        organization_id=organization.id,
        name="Anonymous" if payload.is_anonymous else payload.name,
        email="anonymous@hidden.local" if payload.is_anonymous else payload.email,
        role=payload.role,
        company=company_name,
        preferred_language=payload.language,
    )
    db.add(respondent)
    db.flush()

    submission = FeedbackSubmission(
        respondent_id=respondent.id,
        organization_id=organization.id,
        tools_used=payload.tools_used,
        pain_points=payload.pain_points,
        new_tool=payload.new_tool,
        status="received",
        priority="normal",
        source_channel=payload.source_channel,
        language=payload.language,
        consent_to_store=payload.consent_to_store,
        is_anonymous=payload.is_anonymous,
    )
    db.add(submission)
    db.flush()

    analysis = FeedbackAnalysis(
        submission_id=submission.id,
        model_version=intelligence.model_version,
        category=category,
        confidence_score=confidence,
        sentiment_label=sentiment_label,
        sentiment_score=sentiment_score,
        summary=summary,
        processing_status="completed",
        needs_human_review=needs_human_review,
    )
    db.add(analysis)

    db.add(
        VisitorEvent(
            event_name="submission",
            path="/feedback",
            referrer=request.headers.get("referer"),
            user_agent=request.headers.get("user-agent"),
            ip_hash=hash_ip(get_client_ip(request)),
        )
    )
    db.commit()

    background_tasks.add_task(
    intelligence.log_mlflow,
    submission,
    category,
    confidence,
    sentiment_label,
    sentiment_score,
    )

    db.refresh(submission)
    db.refresh(respondent)
    db.refresh(analysis)
    submission.respondent = respondent
    submission.analyses = [analysis]
    submission.latest_analysis = analysis

    vector_store.add_feedback(submission)
    intelligence.log_mlflow(submission, category, confidence, sentiment_label, sentiment_score)

    return serialize_feedback(submission)


@app.get("/feedback", response_model=list[FeedbackResponse], dependencies=[Depends(require_admin_api_key)])
def list_feedback(db: Session = Depends(get_db)):
    rows = get_feedback_query(db).all()
    return [serialize_feedback(row) for row in rows]


@app.get("/feedback/export", dependencies=[Depends(require_admin_api_key)])
def export_feedback(db: Session = Depends(get_db)):
    rows = get_feedback_query(db).all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id",
        "submission_id",
        "name",
        "email",
        "role",
        "company",
        "tools_used",
        "pain_points",
        "new_tool",
        "status",
        "priority",
        "tags",
        "owner",
        "source_channel",
        "language",
        "consent_to_store",
        "is_anonymous",
        "category",
        "confidence_score",
        "sentiment_label",
        "sentiment_score",
        "summary",
        "processing_status",
        "needs_human_review",
        "created_at",
        "updated_at",
    ])

    for item in rows:
        latest_analysis = max(item.analyses, key=lambda analysis_row: analysis_row.created_at) if item.analyses else None
        respondent = item.respondent
        writer.writerow([
            item.id,
            item.submission_id,
            respondent.name if respondent else "",
            respondent.email if respondent else "",
            respondent.role if respondent else "",
            respondent.company if respondent else "",
            item.tools_used,
            item.pain_points,
            item.new_tool,
            item.status,
            item.priority,
            item.tags or "",
            item.owner or "",
            item.source_channel,
            item.language,
            item.consent_to_store,
            item.is_anonymous,
            latest_analysis.category if latest_analysis else "",
            latest_analysis.confidence_score if latest_analysis and latest_analysis.confidence_score is not None else "",
            latest_analysis.sentiment_label if latest_analysis else "",
            latest_analysis.sentiment_score if latest_analysis and latest_analysis.sentiment_score is not None else "",
            latest_analysis.summary if latest_analysis else "",
            latest_analysis.processing_status if latest_analysis else "",
            latest_analysis.needs_human_review if latest_analysis else "",
            item.created_at.isoformat() if item.created_at else "",
            item.updated_at.isoformat() if item.updated_at else "",
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="feedback_export.csv"'},
    )


@app.get("/analytics/summary", response_model=AnalyticsResponse, dependencies=[Depends(require_admin_api_key)])
def analytics_summary(db: Session = Depends(get_db)):
    total_responses = db.query(FeedbackSubmission).count()

    page_views = db.query(VisitorEvent).filter(
        VisitorEvent.event_name == "page_view"
    ).count()

    submissions = db.query(VisitorEvent).filter(
        VisitorEvent.event_name == "submission"
    ).count() or total_responses

    conversion_rate = round((submissions / page_views) * 100, 2) if page_views else 0.0

    unique_companies = db.query(Respondent.company).distinct().count()
    unique_roles = db.query(Respondent.role).distinct().count()

    top_rows = (
        db.query(FeedbackAnalysis.category, func.count(FeedbackAnalysis.id))
        .group_by(FeedbackAnalysis.category)
        .order_by(func.count(FeedbackAnalysis.id).desc())
        .all()
    )

    top_issues = [
        CategoryCount(label=(label or "Other"), count=count)
        for label, count in top_rows
    ]

    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    daily_rows = (
        db.query(
            cast(VisitorEvent.created_at, Date).label("day"),
            func.count(VisitorEvent.id),
        )
        .filter(VisitorEvent.created_at.isnot(None))
        .filter(VisitorEvent.created_at >= seven_days_ago)
        .group_by(cast(VisitorEvent.created_at, Date))
        .order_by(cast(VisitorEvent.created_at, Date))
        .all()
    )

    daily_visits = [
        {"date": day.isoformat(), "count": count}
        for day, count in daily_rows
        if day is not None
    ]

    latest_row = (
        db.query(FeedbackSubmission.created_at)
        .order_by(FeedbackSubmission.created_at.desc())
        .first()
    )

    latest_submission = None
    if latest_row and latest_row[0]:
        latest_submission = latest_row[0].isoformat() if hasattr(latest_row[0], "isoformat") else str(latest_row[0])

    return AnalyticsResponse(
        total_responses=total_responses,
        page_views=page_views,
        submissions=submissions,
        conversion_rate=conversion_rate,
        unique_companies=unique_companies,
        unique_roles=unique_roles,
        top_issues=top_issues,
        daily_visits=daily_visits,
        latest_submission=latest_submission,
    )


@app.get("/insights/summary", dependencies=[Depends(require_admin_api_key)])
def insights_summary(db: Session = Depends(get_db)):
    rows = get_feedback_query(db).all()

    feedback_texts = []
    for row in rows:
        text = " ".join([
            row.tools_used or "",
            row.pain_points or "",
            row.new_tool or "",
        ])
        feedback_texts.append(text.strip())

    if llm_service.is_available():
        report = llm_service.generate_insights(feedback_texts)
        return report

    # fallback to old ML
    for row in rows:
        row.latest_analysis = max(row.analyses, key=lambda x: x.created_at) if row.analyses else None

    return intelligence.build_insights(rows)


@app.post("/search", response_model=SearchResponse, dependencies=[Depends(require_admin_api_key)])
def semantic_search(payload: SearchRequest, db: Session = Depends(get_db)):
    _ = db
    matches = vector_store.search(payload.query, payload.k)
    answer = intelligence.build_rag_answer(payload.query, matches)
    return SearchResponse(answer=answer, matches=matches)
