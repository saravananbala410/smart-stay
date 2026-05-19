"""
routers/electricity.py - Electricity bill management per room
Admin sets monthly bill per room → auto-split across active tenants in that room
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app import models
from app.auth import get_current_hostel

router = APIRouter()

class ElecBillCreate(BaseModel):
    room_number: str
    total_amount: float
    month_year: str   # "2025-04"

class AddChargeCreate(BaseModel):
    charge_name: str   # "Water", "Internet", etc.
    total_amount: float
    month_year: str


# ─── ELECTRICITY ────────────────────────────

@router.post("/electricity", status_code=201)
def add_electricity_bill(
    payload: ElecBillCreate,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    hid = current_hostel.hostel_id

    # Count active tenants in this room
    room = db.query(models.Room).filter(
        models.Room.hostel_id   == hid,
        models.Room.room_number == payload.room_number
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    active_count = db.query(models.Tenant).filter(
        models.Tenant.hostel_id == hid,
        models.Tenant.room_id   == room.room_id,
        models.Tenant.status    == "Active"
    ).count()

    if active_count == 0:
        raise HTTPException(status_code=400, detail="No active tenants in this room")

    per_tenant = round(payload.total_amount / active_count, 2)

    # Upsert: delete old and re-create if already exists
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

    # Update all active payment entries for this month in this room
    active_tenants = db.query(models.Tenant).filter(
        models.Tenant.hostel_id == hid,
        models.Tenant.room_id   == room.room_id,
        models.Tenant.status    == "Active"
    ).all()

    for tenant in active_tenants:
        payment = db.query(models.Payment).filter(
            models.Payment.tenant_id  == tenant.tenant_id,
            models.Payment.month_year == payload.month_year
        ).first()
        if payment:
            payment.electricity_amount = per_tenant

    db.commit()
    return {
        "message"    : f"Electricity bill set for Room {payload.room_number}",
        "total"      : payload.total_amount,
        "active_tenants": active_count,
        "per_tenant" : per_tenant
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
    return query.order_by(models.ElectricityBill.month_year.desc()).all()


# ─── ADDITIONAL CHARGES ─────────────────────

@router.post("/additional", status_code=201)
def add_additional_charge(
    payload: AddChargeCreate,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    hid = current_hostel.hostel_id

    # Split across ALL active tenants in the hostel
    active_count = db.query(models.Tenant).filter(
        models.Tenant.hostel_id == hid,
        models.Tenant.status    == "Active"
    ).count()

    if active_count == 0:
        raise HTTPException(status_code=400, detail="No active tenants in hostel")

    per_tenant = round(payload.total_amount / active_count, 2)

    # Upsert by charge_name + month_year
    existing = db.query(models.AdditionalCharge).filter(
        models.AdditionalCharge.hostel_id   == hid,
        models.AdditionalCharge.charge_name == payload.charge_name,
        models.AdditionalCharge.month_year  == payload.month_year
    ).first()
    if existing:
        existing.total_amount = payload.total_amount
        existing.per_tenant   = per_tenant
    else:
        charge = models.AdditionalCharge(
            hostel_id    = hid,
            charge_name  = payload.charge_name,
            total_amount = payload.total_amount,
            month_year   = payload.month_year,
            per_tenant   = per_tenant
        )
        db.add(charge)

    # Update all active payment entries for this month
    active_tenants = db.query(models.Tenant).filter(
        models.Tenant.hostel_id == hid,
        models.Tenant.status    == "Active"
    ).all()
    for tenant in active_tenants:
        payment = db.query(models.Payment).filter(
            models.Payment.tenant_id  == tenant.tenant_id,
            models.Payment.month_year == payload.month_year
        ).first()
        if payment:
            # Recompute additional_amount: sum of all add charges for this month
            all_add = db.query(models.AdditionalCharge).filter(
                models.AdditionalCharge.hostel_id  == hid,
                models.AdditionalCharge.month_year == payload.month_year
            ).all()
            payment.additional_amount = sum(ac.per_tenant for ac in all_add)

    db.commit()
    return {
        "message"        : f"{payload.charge_name} charge added",
        "total"          : payload.total_amount,
        "active_tenants" : active_count,
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
    return query.order_by(models.AdditionalCharge.month_year.desc()).all()
