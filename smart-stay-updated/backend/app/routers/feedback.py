"""
routers/feedback.py - Testing Feedback API
Public endpoint: anyone, from any phone/device, can submit feedback (name + message).
No login required, so the data is stored regardless of who/where it comes from.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.post("/", response_model=schemas.FeedbackResponse, status_code=201)
def submit_feedback(
    payload: schemas.FeedbackCreate,
    db: Session = Depends(get_db)
):
    feedback = models.Feedback(
        name    = payload.name,
        message = payload.message
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/", response_model=List[schemas.FeedbackResponse])
def list_feedback(db: Session = Depends(get_db)):
    return db.query(models.Feedback).order_by(models.Feedback.created_at.desc()).all()
