from __future__ import annotations

from sqlalchemy import DateTime
from datetime import datetime, timedelta, timezone
from io import StringIO
from pathlib import Path
import csv
import os


from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import Date, cast, func, inspect, text
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .models import Feedback, VisitorEvent
from .schemas import (
    AnalyticsResponse,
    CategoryCount,
    FeedbackCreate,
    FeedbackResponse,
    InsightResponse,
    SearchRequest,
    SearchResponse,
    TrackingEvent,
)
from .security import RateLimitMiddleware, SecurityHeadersMiddleware, get_client_ip, hash_ip, require_admin_api_key
from .ml_service import IntelligenceEngine
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


def migrate_columns() -> None:
    inspector = inspect(engine)

    if "feedback" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("feedback")}
    alters = []

    if "category" not in existing:
        alters.append("ALTER TABLE feedback ADD COLUMN category VARCHAR(50)")
    if "sentiment_label" not in existing:
        alters.append("ALTER TABLE feedback ADD COLUMN sentiment_label VARCHAR(20)")
    if "sentiment_score" not in existing:
        alters.append("ALTER TABLE feedback ADD COLUMN sentiment_score FLOAT")
    if "summary" not in existing:
        alters.append("ALTER TABLE feedback ADD COLUMN summary TEXT")

    if alters:
        with engine.begin() as conn:
            for stmt in alters:
                conn.execute(text(stmt))


def refresh_vector_store(db: Session) -> None:
    rows = db.query(Feedback).order_by(Feedback.created_at.desc()).all()
    vector_store.rebuild(rows)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    migrate_columns()
    db = SessionLocal()
    try:
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
    )

    category, confidence = intelligence.classify(combined_text)
    sentiment_label, sentiment_score = intelligence.sentiment(combined_text)
    summary = intelligence.summarize_feedback(combined_text)

    feedback = Feedback(
        name=payload.name,
        email=payload.email,
        role=payload.role,
        company=payload.company,
        tools_used=payload.tools_used,
        pain_points=payload.pain_points,
        new_tool=payload.new_tool,
        category=category,
        sentiment_label=sentiment_label,
        sentiment_score=sentiment_score,
        summary=summary,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    vector_store.add_feedback(feedback)
    intelligence.log_mlflow(feedback, category, confidence, sentiment_label, sentiment_score)

    # Log conversion event too
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

    return feedback


@app.get("/feedback", response_model=list[FeedbackResponse], dependencies=[Depends(require_admin_api_key)])
def list_feedback(db: Session = Depends(get_db)):
    return db.query(Feedback).order_by(Feedback.created_at.desc()).all()


@app.get("/feedback/export", dependencies=[Depends(require_admin_api_key)])
def export_feedback(db: Session = Depends(get_db)):
    rows = db.query(Feedback).order_by(Feedback.created_at.desc()).all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id",
        "name",
        "email",
        "role",
        "company",
        "tools_used",
        "pain_points",
        "new_tool",
        "category",
        "sentiment_label",
        "sentiment_score",
        "summary",
        "created_at",
    ])

    for item in rows:
        writer.writerow([
            item.id,
            item.name,
            item.email,
            item.role,
            item.company,
            item.tools_used,
            item.pain_points,
            item.new_tool,
            item.category or "",
            item.sentiment_label or "",
            item.sentiment_score if item.sentiment_score is not None else "",
            item.summary or "",
            item.created_at,
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="feedback_export.csv"'},
    )


@app.get("/analytics/summary", response_model=AnalyticsResponse, dependencies=[Depends(require_admin_api_key)])
def analytics_summary(db: Session = Depends(get_db)):
    total_responses = db.query(Feedback).count()

    page_views = db.query(VisitorEvent).filter(
        VisitorEvent.event_name == "page_view"
    ).count()

    submissions = db.query(VisitorEvent).filter(
        VisitorEvent.event_name == "submission"
    ).count() or total_responses

    conversion_rate = round((submissions / page_views) * 100, 2) if page_views else 0.0

    unique_companies = db.query(Feedback.company).distinct().count()
    unique_roles = db.query(Feedback.role).distinct().count()

    # ✅ Top issues
    top_rows = (
        db.query(Feedback.category, func.count(Feedback.id))
        .group_by(Feedback.category)
        .order_by(func.count(Feedback.id).desc())
        .all()
    )

    top_issues = [
        CategoryCount(label=(label or "Other"), count=count)
        for label, count in top_rows
    ]

    # ✅ FIXED: SQLite-safe date grouping
    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    daily_rows = (
        db.query(
            func.strftime('%Y-%m-%d', VisitorEvent.created_at).label("day"),
            func.count(VisitorEvent.id)
        )
        .filter(VisitorEvent.created_at != None)  # prevent null crash
        .filter(VisitorEvent.created_at >= seven_days_ago)
        .group_by("day")
        .order_by("day")
        .all()
    )

    daily_visits = [
        {"date": day, "count": count}
        for day, count in daily_rows if day is not None
    ]

    # ✅ Latest submission (safe)
    latest_row = (
        db.query(Feedback.created_at)
        .order_by(Feedback.created_at.desc())
        .first()
    )

    latest_submission = None
    if latest_row and latest_row[0]:
        if isinstance(latest_row[0], str):
            latest_submission = latest_row[0]
        else:
            latest_submission = latest_row[0].isoformat()

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
    rows = db.query(Feedback).order_by(Feedback.created_at.desc()).all()
    report = intelligence.build_insights(rows)
    return InsightResponse(**report)


@app.post("/search", response_model=SearchResponse, dependencies=[Depends(require_admin_api_key)])
def semantic_search(payload: SearchRequest, db: Session = Depends(get_db)):
    matches = vector_store.search(payload.query, payload.k)
    answer = intelligence.build_rag_answer(payload.query, matches)
    return SearchResponse(answer=answer, matches=matches)