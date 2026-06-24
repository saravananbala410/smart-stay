"""
routers/feedback.py - Tester feedback API
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app import models, schemas
from app.auth import get_current_hostel

router = APIRouter()


@router.get("/", response_model=List[schemas.FeedbackResponse])
def list_feedback(
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    return db.query(models.Feedback).order_by(
        models.Feedback.created_at.desc()
    ).limit(50).all()


@router.post("/", response_model=schemas.FeedbackResponse, status_code=201)
def create_feedback(
    payload: schemas.FeedbackCreate,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel),
    user_agent: Optional[str] = Header(None)
):
    name = payload.name.strip()
    message = payload.message.strip()
    if not name or not message:
        raise HTTPException(status_code=400, detail="Name and feedback are required")

    feedback = models.Feedback(
        hostel_id=current_hostel.hostel_id,
        name=name,
        message=message,
        device=(payload.device or user_agent or "")[:255] or None
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback
