"""
routers/reports.py - Defaulters report
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app import models
from app.auth import get_current_hostel
from app.billing import payment_snapshots

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
    snapshots = payment_snapshots(db, payments)

    defaulters = []
    for p in payments:
        snapshot = snapshots[p.payment_id]
        balance = snapshot["balance"]
        if balance > 0:
            tenant = p.tenant
            room_info = f"Room {tenant.room.room_number}" if tenant and tenant.room else "N/A"
            defaulters.append({
                "tenant_id"    : p.tenant_id,
                "tenant_name"  : tenant.name if tenant else "Unknown",
                "phone"        : tenant.phone if tenant else "",
                "room"         : room_info,
                "month_year"   : p.month_year,
                "due_amount"   : snapshot["current_charges"],
                "electricity_amount": p.electricity_amount,
                "additional_amount": p.additional_amount,
                "arrears"      : snapshot["opening_balance"],
                "opening_credit": snapshot["opening_credit"],
                "payable"      : snapshot["payable"],
                "amount_paid"  : snapshot["amount_paid"],
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

    snapshot_map = payment_snapshots(db, payments)
    snapshots = list(snapshot_map.values())
    total_due = sum(s["current_charges"] for s in snapshots)
    total_collected = sum(s["amount_paid"] for s in snapshots)
    total_arrears = sum(s["opening_balance"] for s in snapshots)
    total_credit = sum(s["opening_credit"] for s in snapshots)
    total_payable = sum(s["payable"] for s in snapshots)
    total_pending = sum(s["balance"] for s in snapshots)

    return {
        "month_year"     : month_year,
        "total_due"      : round(total_due, 2),
        "total_collected": round(total_collected, 2),
        "total_arrears"  : round(total_arrears, 2),
        "total_credit"   : round(total_credit, 2),
        "total_payable"  : round(total_payable, 2),
        "total_pending"  : round(total_pending, 2),
        "collection_rate": round((total_collected / total_payable * 100) if total_payable > 0 else 0, 1)
    }
