"""
routers/reports.py - Defaulters report
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app import models
from app.auth import get_current_hostel

router = APIRouter()

@router.get("/defaulters")
def get_defaulters(
    month_year: str = None,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    hid = current_hostel.hostel_id
    if not month_year:
        month_year = datetime.now().strftime("%Y-%m")

    payments = db.query(models.Payment).filter(
        models.Payment.hostel_id  == hid,
        models.Payment.month_year == month_year
    ).all()

    defaulters = []
    for p in payments:
        balance = p.due_amount - p.amount_paid + p.arrears
        if balance > 0:
            tenant = p.tenant
            room_info = f"Room {tenant.room.room_number}" if tenant and tenant.room else "N/A"
            defaulters.append({
                "tenant_id"    : p.tenant_id,
                "tenant_name"  : tenant.name if tenant else "Unknown",
                "phone"        : tenant.phone if tenant else "",
                "room"         : room_info,
                "month_year"   : p.month_year,
                "due_amount"   : p.due_amount,
                "arrears"      : p.arrears,
                "amount_paid"  : p.amount_paid,
                "balance_due"  : round(balance, 2)
            })

    return {
        "month_year"      : month_year,
        "total_defaulters": len(defaulters),
        "total_pending"   : round(sum(d["balance_due"] for d in defaulters), 2),
        "defaulters"      : defaulters
    }

@router.get("/monthly-summary")
def monthly_summary(
    month_year: str = None,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    hid = current_hostel.hostel_id
    if not month_year:
        month_year = datetime.now().strftime("%Y-%m")

    payments = db.query(models.Payment).filter(
        models.Payment.hostel_id  == hid,
        models.Payment.month_year == month_year
    ).all()

    total_due      = sum(p.due_amount for p in payments)
    total_collected= sum(p.amount_paid for p in payments)
    total_arrears  = sum(p.arrears for p in payments)
    total_pending  = sum(max(0, p.due_amount - p.amount_paid + p.arrears) for p in payments)

    return {
        "month_year"     : month_year,
        "total_due"      : round(total_due, 2),
        "total_collected": round(total_collected, 2),
        "total_arrears"  : round(total_arrears, 2),
        "total_pending"  : round(total_pending, 2),
        "collection_rate": round((total_collected / total_due * 100) if total_due > 0 else 0, 1)
    }
