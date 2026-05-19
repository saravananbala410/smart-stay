"""
routers/notices.py - Notice board API
FIX #6: When a notice is posted, send SMS to all active tenants via Twilio/MSG91
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import os

from app.database import get_db
from app import models, schemas
from app.auth import get_current_hostel

router = APIRouter()


def send_sms_to_tenants(tenants, notice_title: str, notice_content: str):
    """
    Send SMS to all active tenants.
    Uses Twilio if TWILIO_SID is set in .env, otherwise logs to console.
    To enable real SMS: pip install twilio and add these to .env:
      TWILIO_SID=ACxxxxx
      TWILIO_TOKEN=xxxxx
      TWILIO_FROM=+1xxxxxxxxxx
    """
    sid   = os.getenv("TWILIO_SID")
    token = os.getenv("TWILIO_TOKEN")
    from_ = os.getenv("TWILIO_FROM")

    message = f"📢 Notice: {notice_title}\n{notice_content}"

    if sid and token and from_:
        try:
            from twilio.rest import Client
            client = Client(sid, token)
            for tenant in tenants:
                phone = tenant.phone.strip()
                if not phone.startswith("+"):
                    phone = "+91" + phone  # India default
                client.messages.create(body=message, from_=from_, to=phone)
        except Exception as e:
            print(f"SMS send failed: {e}")
    else:
        # No Twilio configured — just log
        for tenant in tenants:
            print(f"[SMS stub] To {tenant.phone}: {message}")


@router.get("/", response_model=List[schemas.NoticeResponse])
def list_notices(
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    return db.query(models.Notice).filter(
        models.Notice.hostel_id == current_hostel.hostel_id
    ).order_by(models.Notice.created_at.desc()).limit(10).all()


@router.post("/", response_model=schemas.NoticeResponse, status_code=201)
def create_notice(
    payload: schemas.NoticeCreate,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    notice = models.Notice(
        hostel_id = current_hostel.hostel_id,
        title     = payload.title,
        content   = payload.content
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)

    # FIX #6: Send SMS to all active tenants
    active_tenants = db.query(models.Tenant).filter(
        models.Tenant.hostel_id == current_hostel.hostel_id,
        models.Tenant.status    == "Active"
    ).all()
    send_sms_to_tenants(active_tenants, payload.title, payload.content)

    return notice


@router.delete("/{notice_id}")
def delete_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    notice = db.query(models.Notice).filter(
        models.Notice.notice_id == notice_id,
        models.Notice.hostel_id == current_hostel.hostel_id
    ).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    db.delete(notice)
    db.commit()
    return {"message": "Notice deleted"}
