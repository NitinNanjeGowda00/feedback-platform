from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import StringIO
import csv

from .database import Base, engine, SessionLocal
from .models import Feedback
from .schemas import FeedbackCreate, FeedbackResponse

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Feedback Application API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://feedback-platform-neon.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "API running"}

@app.post("/feedback", response_model=FeedbackResponse)
def create_feedback(payload: FeedbackCreate, db: Session = Depends(get_db)):
    feedback = Feedback(
        name=payload.name,
        email=payload.email,
        role=payload.role,
        company=payload.company,
        tools_used=payload.tools_used,
        pain_points=payload.pain_points,
        new_tool=payload.new_tool
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback

@app.get("/feedback", response_model=list[FeedbackResponse])
def list_feedback(db: Session = Depends(get_db)):
    return db.query(Feedback).order_by(Feedback.created_at.desc()).all()

@app.get("/feedback/export")
def export_feedback(db: Session = Depends(get_db)):
    feedback_list = db.query(Feedback).order_by(Feedback.created_at.desc()).all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "name", "email", "role", "company",
        "tools_used", "pain_points", "new_tool", "created_at"
    ])

    for item in feedback_list:
        writer.writerow([
            item.id, item.name, item.email, item.role, item.company,
            item.tools_used, item.pain_points, item.new_tool, item.created_at
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=feedback_export.csv"}
    )