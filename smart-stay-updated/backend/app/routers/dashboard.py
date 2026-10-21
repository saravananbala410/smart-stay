"""
routers/dashboard.py - Dashboard stats API (enhanced)
FIX #5: Added hostel image, address, vacant rooms list, vacated tenant count
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from dateutil.relativedelta import relativedelta
from typing import Optional

from app.database import get_db
from app import models
from app.auth import get_current_hostel
from app.billing import payment_snapshots

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    hid = current_hostel.hostel_id
    current_month = datetime.now().strftime("%Y-%m")

    total_tenants = db.query(models.Tenant).filter(
        models.Tenant.hostel_id == hid,
        models.Tenant.status == "Active"
    ).count()

    vacated_tenants = db.query(models.Tenant).filter(
        models.Tenant.hostel_id == hid,
        models.Tenant.status == "Vacated"
    ).count()

    rooms = db.query(models.Room).filter(models.Room.hostel_id == hid).all()
    vacant_beds  = sum(r.total_beds - r.occupied_beds for r in rooms)
    total_beds   = sum(r.total_beds for r in rooms)
    occupied_beds= sum(r.occupied_beds for r in rooms)
    total_rooms  = len(rooms)
    vacant_rooms = [
        {"room_number": r.room_number, "vacant_beds": r.total_beds - r.occupied_beds}
        for r in rooms if r.occupied_beds < r.total_beds
    ]

    # paid_at is stored in UTC; convert local month boundaries to UTC.
    local_now = datetime.now().astimezone()
    local_start = local_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_start = (local_start - local_start.utcoffset()).replace(tzinfo=None)
    next_month = ((local_start + relativedelta(months=1)) - local_start.utcoffset()).replace(tzinfo=None)
    total_collection = db.query(func.sum(models.PaymentTransaction.amount)).filter(
        models.PaymentTransaction.hostel_id == hid,
        models.PaymentTransaction.status == "RECEIVED",
        models.PaymentTransaction.paid_at >= month_start,
        models.PaymentTransaction.paid_at < next_month,
    ).scalar() or 0

    payments_this_month = db.query(models.Payment).filter(
        models.Payment.hostel_id == hid,
        models.Payment.month_year == current_month
    ).all()
    snapshots = payment_snapshots(db, payments_this_month)
    total_pending = sum(snapshots[p.payment_id]["balance"] for p in payments_this_month)

    return {
        "hostel_name"                : current_hostel.name,
        "hostel_address"             : current_hostel.address,
        "hostel_image"               : current_hostel.image_url,
        "upi_id"                     : current_hostel.upi_id,
        "payment_due_day"            : current_hostel.payment_due_day or 5,
        "total_tenants"              : total_tenants,
        "vacated_tenants"            : vacated_tenants,
        "vacant_beds"                : vacant_beds,
        "total_beds"                 : total_beds,
        "occupied_beds"              : occupied_beds,
        "occupancy_rate"             : round((occupied_beds / total_beds * 100) if total_beds else 0, 1),
        "total_collection_this_month": round(total_collection, 2),
        "total_pending_rent"         : round(total_pending, 2),
        "total_rooms"                : total_rooms,
        "vacant_rooms"               : vacant_rooms
    }


@router.patch("/hostel-info")
def update_hostel_info(
    address:   Optional[str] = Query(None),
    image_url: Optional[str] = Query(None),
    upi_id: Optional[str] = Query(None),
    payment_due_day: Optional[int] = Query(None, ge=1, le=28),
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    hostel = db.query(models.Hostel).filter(
        models.Hostel.hostel_id == current_hostel.hostel_id
    ).first()
    if address is not None:
        hostel.address = address
    if image_url is not None:
        hostel.image_url = image_url
    if upi_id is not None:
        cleaned_upi = upi_id.strip()
        if cleaned_upi and ("@" not in cleaned_upi or " " in cleaned_upi):
            raise HTTPException(status_code=422, detail="Enter a valid UPI ID, for example hostel@bank")
        hostel.upi_id = cleaned_upi or None
    if payment_due_day is not None:
        hostel.payment_due_day = payment_due_day
    db.commit()
    return {"message": "Hostel info updated"}
