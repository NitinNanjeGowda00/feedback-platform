from __future__ import annotations

import csv
import os
from datetime import datetime, timedelta
from io import StringIO

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_phase1_tables() -> None:
    if not IS_SQLITE:
        return

    statements = [
        """
        CREATE TABLE IF NOT EXISTS organizations (
            id INTEGER PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            slug VARCHAR(150) NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS respondents (
            id INTEGER PRIMARY KEY,
            organization_id INTEGER NULL,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(150) NOT NULL,
            role VARCHAR(100) NOT NULL,
            company VARCHAR(150) NOT NULL,
            preferred_language VARCHAR(20) DEFAULT 'en' NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            archived_at DATETIME NULL,
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS feedback_submissions (
            id INTEGER PRIMARY KEY,
            submission_id VARCHAR(36) NOT NULL UNIQUE,
            respondent_id INTEGER NULL,
            organization_id INTEGER NULL,
            tools_used TEXT NOT NULL,
            pain_points TEXT NOT NULL,
            new_tool TEXT NOT NULL,
            status VARCHAR(30) DEFAULT 'received' NOT NULL,
            priority VARCHAR(20) DEFAULT 'normal' NOT NULL,
            tags TEXT NULL,
            owner VARCHAR(150) NULL,
            source_channel VARCHAR(50) DEFAULT 'web' NOT NULL,
            language VARCHAR(20) DEFAULT 'en' NOT NULL,
            consent_to_store BOOLEAN DEFAULT 1 NOT NULL,
            is_anonymous BOOLEAN DEFAULT 0 NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            archived_at DATETIME NULL,
            FOREIGN KEY(respondent_id) REFERENCES respondents(id),
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS feedback_analysis (
            id INTEGER PRIMARY KEY,
            submission_id INTEGER NOT NULL,
            model_version VARCHAR(100) DEFAULT 'rules-v1' NOT NULL,
            category VARCHAR(50) NULL,
            confidence_score FLOAT NULL,
            sentiment_label VARCHAR(20) NULL,
            sentiment_score FLOAT NULL,
            summary TEXT NULL,
            processing_status VARCHAR(30) DEFAULT 'completed' NOT NULL,
            needs_human_review BOOLEAN DEFAULT 0 NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            FOREIGN KEY(submission_id) REFERENCES feedback_submissions(id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_feedback_submissions_status ON feedback_submissions(status)",
        "CREATE INDEX IF NOT EXISTS ix_feedback_submissions_priority ON feedback_submissions(priority)",
        "CREATE INDEX IF NOT EXISTS ix_feedback_submissions_source_channel ON feedback_submissions(source_channel)",
        "CREATE INDEX IF NOT EXISTS ix_feedback_submissions_language ON feedback_submissions(language)",
        "CREATE INDEX IF NOT EXISTS ix_feedback_submissions_is_anonymous ON feedback_submissions(is_anonymous)",
        "CREATE INDEX IF NOT EXISTS ix_feedback_analysis_category ON feedback_analysis(category)",
        "CREATE INDEX IF NOT EXISTS ix_feedback_analysis_processing_status ON feedback_analysis(processing_status)",
        "CREATE INDEX IF NOT EXISTS ix_feedback_analysis_sentiment_label ON feedback_analysis(sentiment_label)",
        "CREATE INDEX IF NOT EXISTS ix_respondents_email ON respondents(email)",
        "CREATE INDEX IF NOT EXISTS ix_respondents_company ON respondents(company)",
        "CREATE INDEX IF NOT EXISTS ix_respondents_role ON respondents(role)",
    ]

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def migrate_legacy_feedback(db: Session) -> None:
    with engine.connect() as conn:
        legacy_exists = engine.dialect.has_table(conn, "feedback")
    if not legacy_exists:
        return

    already_migrated = db.query(FeedbackSubmission).first()
    if already_migrated:
        return

    rows = db.execute(
        text(
            """
            SELECT id, name, email, role, company, tools_used, pain_points, new_tool,
                   category, sentiment_label, sentiment_score, summary, created_at
            FROM feedback
            ORDER BY created_at ASC, id ASC
            """
        )
    ).mappings().all()

    org_cache: dict[str, Organization] = {}

    for row in rows:
        company = (row["company"] or "Independent").strip() or "Independent"
        org = org_cache.get(company.lower())
        if org is None:
            slug = company.lower().replace(" ", "-")
            org = db.query(Organization).filter(Organization.slug == slug).first()
            if org is None:
                org = Organization(name=company, slug=slug)
                db.add(org)
                db.flush()
            org_cache[company.lower()] = org

        respondent = Respondent(
            organization_id=org.id,
            name=row["name"],
            email=row["email"],
            role=row["role"],
            company=company,
            preferred_language="en",
        )
        db.add(respondent)
        db.flush()

        submission = FeedbackSubmission(
            respondent_id=respondent.id,
            organization_id=org.id,
            tools_used=row["tools_used"],
            pain_points=row["pain_points"],
            new_tool=row["new_tool"],
            status="received",
            priority="normal",
            source_channel="web",
            language="en",
            consent_to_store=True,
            is_anonymous=False,
            created_at=row["created_at"] or datetime.utcnow(),
            updated_at=row["created_at"] or datetime.utcnow(),
        )
        db.add(submission)
        db.flush()

        analysis = FeedbackAnalysis(
            submission_id=submission.id,
            model_version=intelligence.model_version,
            category=row["category"],
            confidence_score=None,
            sentiment_label=row["sentiment_label"],
            sentiment_score=row["sentiment_score"],
            summary=row["summary"],
            processing_status="completed",
            needs_human_review=False,
            created_at=row["created_at"] or datetime.utcnow(),
            updated_at=row["created_at"] or datetime.utcnow(),
        )
        db.add(analysis)

    db.commit()


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
    if IS_SQLITE:
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
def create_feedback(payload: FeedbackCreate, request: Request, db: Session = Depends(get_db)):
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

    day_bucket = func.date(VisitorEvent.created_at)

    daily_rows = (
        db.query(
            day_bucket.label("day"),
            func.count(VisitorEvent.id),
        )
        .filter(VisitorEvent.created_at.isnot(None))
        .filter(VisitorEvent.created_at >= seven_days_ago)
        .group_by(day_bucket)
        .order_by(day_bucket)
        .all()
    )

    daily_visits = [
        {"date": day, "count": count}
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


@app.get("/insights/summary", response_model=InsightResponse, dependencies=[Depends(require_admin_api_key)])
def insights_summary(db: Session = Depends(get_db)):
    rows = get_feedback_query(db).all()
    for row in rows:
        row.latest_analysis = max(row.analyses, key=lambda item: item.created_at) if row.analyses else None
    report = intelligence.build_insights(rows)
    return InsightResponse(**report)


@app.post("/search", response_model=SearchResponse, dependencies=[Depends(require_admin_api_key)])
def semantic_search(payload: SearchRequest, db: Session = Depends(get_db)):
    _ = db
    matches = vector_store.search(payload.query, payload.k)
    answer = intelligence.build_rag_answer(payload.query, matches)
    return SearchResponse(answer=answer, matches=matches)
