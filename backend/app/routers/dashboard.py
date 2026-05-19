"""
routers/dashboard.py - Dashboard stats API (enhanced)
FIX #5: Added hostel image, address, vacant rooms list, vacated tenant count
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Optional

from app.database import get_db
from app import models
from app.auth import get_current_hostel

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
    total_rooms  = len(rooms)
    vacant_rooms = [
        {"room_number": r.room_number, "vacant_beds": r.total_beds - r.occupied_beds}
        for r in rooms if r.occupied_beds < r.total_beds
    ]

    total_collection = db.query(func.sum(models.Payment.amount_paid)).filter(
        models.Payment.hostel_id == hid,
        models.Payment.month_year == current_month
    ).scalar() or 0

    payments_this_month = db.query(models.Payment).filter(
        models.Payment.hostel_id == hid,
        models.Payment.month_year == current_month
    ).all()
    total_pending = sum(
        max(0, (p.due_amount + p.electricity_amount + p.additional_amount) - p.amount_paid + p.arrears)
        for p in payments_this_month
    )

    return {
        "hostel_name"                : current_hostel.name,
        "hostel_address"             : current_hostel.address,
        "hostel_image"               : current_hostel.image_url,
        "total_tenants"              : total_tenants,
        "vacated_tenants"            : vacated_tenants,
        "vacant_beds"                : vacant_beds,
        "total_collection_this_month": round(total_collection, 2),
        "total_pending_rent"         : round(total_pending, 2),
        "total_rooms"                : total_rooms,
        "vacant_rooms"               : vacant_rooms
    }


@router.patch("/hostel-info")
def update_hostel_info(
    address:   Optional[str] = Query(None),
    image_url: Optional[str] = Query(None),
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
    db.commit()
    return {"message": "Hostel info updated"}
