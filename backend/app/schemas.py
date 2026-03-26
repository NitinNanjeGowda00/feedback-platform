from pydantic import BaseModel, EmailStr
from datetime import datetime

class FeedbackCreate(BaseModel):
    name: str
    email: EmailStr
    role: str
    company: str
    tools_used: str
    pain_points: str
    new_tool: str

class FeedbackResponse(FeedbackCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True