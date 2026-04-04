from sqlalchemy import Column, Integer, String, DateTime, Text, Float
from sqlalchemy.sql import func
from .database import Base
from datetime import datetime


created_at = Column(DateTime, default=datetime.utcnow)


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    email = Column(String(150), nullable=False, index=True)
    role = Column(String(100), nullable=False, index=True)
    company = Column(String(150), nullable=False, index=True)
    tools_used = Column(Text, nullable=False)
    pain_points = Column(Text, nullable=False)
    new_tool = Column(Text, nullable=False)

    category = Column(String(50), nullable=True, index=True)
    sentiment_label = Column(String(20), nullable=True)
    sentiment_score = Column(Float, nullable=True)
    summary = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VisitorEvent(Base):
    __tablename__ = "visitor_events"

    id = Column(Integer, primary_key=True, index=True)
    event_name = Column(String(50), nullable=False, index=True)  # page_view, form_submit, etc.
    path = Column(String(255), nullable=True, index=True)
    referrer = Column(Text, nullable=True)
    user_agent = Column(Text, nullable=True)
    ip_hash = Column(String(128), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())