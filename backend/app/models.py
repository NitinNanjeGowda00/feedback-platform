from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from .database import Base

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False)
    role = Column(String(100), nullable=False)
    company = Column(String(150), nullable=False)
    tools_used = Column(Text, nullable=False)
    pain_points = Column(Text, nullable=False)
    new_tool = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())