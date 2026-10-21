"""
routers/electricity.py - Electricity bill management per room + custom charges
FIX #7: Dynamic electricity billing with auto-split per room
FIX #8: Custom "Add Feature" module — room-specific or hostel-wide split
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, Field

from app.database import get_db
from app import models
from app.auth import get_current_hostel
from app.billing import charge_breakdown, money, month_bounds, tenant_is_billable

router = APIRouter()


class ElecBillCreate(BaseModel):
    room_number: str
    total_amount: float = Field(gt=0, le=10000000)
    month_year: str   # "2025-04"


class AddChargeCreate(BaseModel):
    charge_name: str           # "Water", "Internet", "Maintenance", etc.
    total_amount: float = Field(gt=0, le=10000000)
    month_year: str
    room_number: Optional[str] = None  # None = hostel-wide split


# ─── ELECTRICITY ────────────────────────────

@router.post("/electricity", status_code=201)
def add_electricity_bill(
    payload: ElecBillCreate,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    """FIX #7: Set monthly electricity bill for a room, auto-split across active tenants."""
    hid = current_hostel.hostel_id
    month_bounds(payload.month_year)

    room = db.query(models.Room).filter(
        models.Room.hostel_id   == hid,
        models.Room.room_number == payload.room_number
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    room_tenants = db.query(models.Tenant).filter(
        models.Tenant.hostel_id == hid,
        models.Tenant.room_id   == room.room_id
    ).all()
    active_tenants = [t for t in room_tenants if tenant_is_billable(t, payload.month_year)]

    if not active_tenants:
        raise HTTPException(status_code=400, detail="No active tenants in this room")

    per_tenant = money(payload.total_amount / len(active_tenants))

    existing = db.query(models.ElectricityBill).filter(
        models.ElectricityBill.hostel_id   == hid,
        models.ElectricityBill.room_number == payload.room_number,
        models.ElectricityBill.month_year  == payload.month_year
    ).first()
    if existing:
        existing.total_amount = payload.total_amount
        existing.per_tenant   = per_tenant
    else:
        bill = models.ElectricityBill(
            hostel_id    = hid,
            room_number  = payload.room_number,
            total_amount = payload.total_amount,
            month_year   = payload.month_year,
            per_tenant   = per_tenant
        )
        db.add(bill)

    db.flush()
    # Update existing payment rows using exact-paise deterministic allocation.
    for tenant in active_tenants:
        payment = db.query(models.Payment).filter(
            models.Payment.tenant_id  == tenant.tenant_id,
            models.Payment.month_year == payload.month_year
        ).first()
        if payment:
            payment.electricity_amount = charge_breakdown(tenant, payload.month_year, db, hid)["electricity"]

    db.commit()
    return {
        "message"        : f"Electricity bill set for Room {payload.room_number}",
        "total"          : payload.total_amount,
        "active_tenants" : len(active_tenants),
        "per_tenant"     : per_tenant,
        "tenants"        : [t.name for t in active_tenants]
    }


@router.get("/electricity")
def list_electricity_bills(
    month_year: Optional[str] = None,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    query = db.query(models.ElectricityBill).filter(
        models.ElectricityBill.hostel_id == current_hostel.hostel_id
    )
    if month_year:
        query = query.filter(models.ElectricityBill.month_year == month_year)
    bills = query.order_by(models.ElectricityBill.month_year.desc()).all()
    rooms = {
        room.room_number: room for room in db.query(models.Room).filter(
            models.Room.hostel_id == current_hostel.hostel_id
        ).all()
    }
    tenants = db.query(models.Tenant).filter(models.Tenant.hostel_id == current_hostel.hostel_id).all()
    result = []
    for bill in bills:
        room = rooms.get(bill.room_number)
        eligible = [t for t in tenants if room and t.room_id == room.room_id and tenant_is_billable(t, bill.month_year)]
        result.append({
            "bill_id": bill.bill_id, "room_number": bill.room_number,
            "total_amount": bill.total_amount, "month_year": bill.month_year,
            "per_tenant": money(bill.total_amount / len(eligible)) if eligible else 0,
            "tenant_count": len(eligible),
        })
    return result


# ─── ADDITIONAL / CUSTOM CHARGES ────────────────

@router.post("/additional", status_code=201)
def add_additional_charge(
    payload: AddChargeCreate,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    """
    FIX #8: Custom expense head.
    - room_number=None  → hostel-wide split among ALL active tenants
    - room_number set   → room-specific split (e.g. water for Room 101)
    """
    hid = current_hostel.hostel_id
    month_bounds(payload.month_year)

    if payload.room_number:
        # Room-specific
        room = db.query(models.Room).filter(
            models.Room.hostel_id   == hid,
            models.Room.room_number == payload.room_number
        ).first()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        room_tenants = db.query(models.Tenant).filter(
            models.Tenant.hostel_id == hid,
            models.Tenant.room_id   == room.room_id
        ).all()
        active_tenants = [t for t in room_tenants if tenant_is_billable(t, payload.month_year)]
    else:
        # Hostel-wide
        hostel_tenants = db.query(models.Tenant).filter(models.Tenant.hostel_id == hid).all()
        active_tenants = [t for t in hostel_tenants if t.room and tenant_is_billable(t, payload.month_year)]

    if not active_tenants:
        raise HTTPException(status_code=400, detail="No active tenants to split across")

    per_tenant = money(payload.total_amount / len(active_tenants))

    existing = db.query(models.AdditionalCharge).filter(
        models.AdditionalCharge.hostel_id   == hid,
        models.AdditionalCharge.charge_name == payload.charge_name,
        models.AdditionalCharge.month_year  == payload.month_year,
        models.AdditionalCharge.room_number == payload.room_number
    ).first()
    if existing:
        existing.total_amount = payload.total_amount
        existing.per_tenant   = per_tenant
    else:
        charge = models.AdditionalCharge(
            hostel_id    = hid,
            charge_name  = payload.charge_name,
            room_number  = payload.room_number,
            total_amount = payload.total_amount,
            month_year   = payload.month_year,
            per_tenant   = per_tenant
        )
        db.add(charge)

    db.flush()
    # Recompute from persisted charges. This avoids the old double-add bug.
    for tenant in active_tenants:
        payment = db.query(models.Payment).filter(
            models.Payment.tenant_id  == tenant.tenant_id,
            models.Payment.month_year == payload.month_year
        ).first()
        if payment:
            payment.additional_amount = charge_breakdown(tenant, payload.month_year, db, hid)["additional"]

    db.commit()
    return {
        "message"        : f"{payload.charge_name} charge added",
        "total"          : payload.total_amount,
        "scope"          : f"Room {payload.room_number}" if payload.room_number else "Hostel-wide",
        "active_tenants" : len(active_tenants),
        "per_tenant"     : per_tenant
    }


@router.get("/additional")
def list_additional_charges(
    month_year: Optional[str] = None,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    query = db.query(models.AdditionalCharge).filter(
        models.AdditionalCharge.hostel_id == current_hostel.hostel_id
    )
    if month_year:
        query = query.filter(models.AdditionalCharge.month_year == month_year)
    results = query.order_by(models.AdditionalCharge.month_year.desc()).all()
    tenants = db.query(models.Tenant).filter(models.Tenant.hostel_id == current_hostel.hostel_id).all()
    return [
        {
            "charge_id"  : c.charge_id,
            "charge_name": c.charge_name,
            "room_number": c.room_number,
            "total_amount": c.total_amount,
            "per_tenant" : c.per_tenant,
            "month_year" : c.month_year,
            "scope"      : f"Room {c.room_number}" if c.room_number else "Hostel-wide"
            ,"tenant_count": len([
                t for t in tenants if t.room and tenant_is_billable(t, c.month_year)
                and (c.room_number is None or (t.room and t.room.room_number == c.room_number))
            ])
        }
        for c in results
    ]
