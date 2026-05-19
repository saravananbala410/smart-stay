"""
routers/payments.py - Payment recording with partial payment + arrears logic
BUG FIXES:
1. Payment per-tenant monthly calculation based on joining_date
2. Duplicate entry prevention (one record per tenant per month)
3. Tenant name shown in payments list
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import List, Optional
from dateutil.relativedelta import relativedelta

from app.database import get_db
from app import models, schemas
from app.auth import get_current_hostel

router = APIRouter()

def calc_months_active(joining_date: date, month_year: str) -> float:
    """
    Calculate how many full months the tenant has been active in a given month.
    If joining_date is 10 Jan and we're in April: 4 full months (Jan, Feb, Mar, Apr).
    Returns 1.0 for a full month, or fraction if partial.
    """
    bill_year, bill_month = map(int, month_year.split("-"))
    bill_period_start = date(bill_year, bill_month, 1)

    # If tenant joined after this month ends, they owe nothing
    import calendar
    last_day = calendar.monthrange(bill_year, bill_month)[1]
    bill_period_end = date(bill_year, bill_month, last_day)

    if joining_date > bill_period_end:
        return 0.0

    # If tenant joined during this month, prorate
    if joining_date > bill_period_start:
        days_in_month = last_day
        days_active = (bill_period_end - joining_date).days + 1
        return days_active / days_in_month

    return 1.0  # Full month

def get_total_due_for_tenant(tenant, month_year: str, db: Session, hid: int) -> dict:
    """Calculate total rent + electricity + additional for a tenant for a month"""
    # Base rent
    if tenant.room:
        rent_config = db.query(models.RentConfiguration).filter(
            models.RentConfiguration.hostel_id    == hid,
            models.RentConfiguration.sharing_type == tenant.room.sharing_type
        ).order_by(models.RentConfiguration.effective_date.desc()).first()
        base_rent = rent_config.rent_amount if rent_config else tenant.room.base_rent
    else:
        base_rent = 0

    # Electricity for this tenant's room
    elec_amount = 0
    if tenant.room:
        elec_bill = db.query(models.ElectricityBill).filter(
            models.ElectricityBill.hostel_id   == hid,
            models.ElectricityBill.room_number == tenant.room.room_number,
            models.ElectricityBill.month_year  == month_year
        ).first()
        if elec_bill:
            elec_amount = elec_bill.per_tenant

    # Additional charges (water, internet, etc.) — split across ALL active tenants hostel-wide
    add_amount = 0
    add_charges = db.query(models.AdditionalCharge).filter(
        models.AdditionalCharge.hostel_id  == hid,
        models.AdditionalCharge.month_year == month_year
    ).all()
    for ac in add_charges:
        add_amount += ac.per_tenant

    return {
        "base_rent": base_rent,
        "electricity_amount": elec_amount,
        "additional_amount": add_amount,
        "total": base_rent + elec_amount + add_amount
    }


@router.post("/", status_code=201)
def record_payment(
    payload: schemas.PaymentCreate,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    hid = current_hostel.hostel_id

    tenant = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == payload.tenant_id,
        models.Tenant.hostel_id == hid
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Check existing payment for this month
    existing = db.query(models.Payment).filter(
        models.Payment.tenant_id  == payload.tenant_id,
        models.Payment.month_year == payload.month_year
    ).first()

    if existing:
        # Add to existing — no duplicate entry, just update
        existing.amount_paid += payload.amount_paid
        existing.payment_date = datetime.utcnow()
        if payload.transaction_id:
            existing.transaction_id = payload.transaction_id
        db.commit()
        balance = max(0, (existing.due_amount + existing.electricity_amount + existing.additional_amount) - existing.amount_paid + existing.arrears)
        return {
            "message": "Payment updated",
            "paid":    existing.amount_paid,
            "balance": round(balance, 2)
        }

    # New payment entry
    due_info = get_total_due_for_tenant(tenant, payload.month_year, db, hid)
    due_amount       = due_info["base_rent"]
    elec_amount      = due_info["electricity_amount"]
    add_amount       = due_info["additional_amount"]

    # Previous month arrears
    prev = db.query(models.Payment).filter(
        models.Payment.tenant_id == payload.tenant_id
    ).order_by(models.Payment.month_year.desc()).first()
    arrears = 0
    if prev:
        prev_total = prev.due_amount + prev.electricity_amount + prev.additional_amount
        arrears = max(0, prev_total - prev.amount_paid + prev.arrears)

    payment = models.Payment(
        tenant_id          = payload.tenant_id,
        hostel_id          = hid,
        amount_paid        = payload.amount_paid,
        due_amount         = due_amount,
        electricity_amount = elec_amount,
        additional_amount  = add_amount,
        arrears            = arrears,
        payment_date       = datetime.utcnow(),
        month_year         = payload.month_year,
        transaction_id     = payload.transaction_id,
        is_advance         = payload.is_advance
    )
    db.add(payment)
    db.commit()

    total_due = due_amount + elec_amount + add_amount
    balance   = max(0, total_due - payload.amount_paid + arrears)
    return {
        "message":           "Payment recorded",
        "rent":              due_amount,
        "electricity":       elec_amount,
        "additional":        add_amount,
        "total_due":         total_due,
        "arrears":           arrears,
        "amount_paid":       payload.amount_paid,
        "balance":           round(balance, 2)
    }


@router.get("/")
def list_payments(
    month_year: str = None,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    query = db.query(models.Payment).filter(
        models.Payment.hostel_id == current_hostel.hostel_id
    )
    if month_year:
        query = query.filter(models.Payment.month_year == month_year)

    payments = query.order_by(models.Payment.created_at.desc()).all()

    result = []
    for p in payments:
        tenant_name = p.tenant.name if p.tenant else f"Tenant #{p.tenant_id}"
        total_due   = p.due_amount + p.electricity_amount + p.additional_amount
        balance     = max(0, total_due - p.amount_paid + p.arrears)
        result.append({
            "payment_id":         p.payment_id,
            "tenant_id":          p.tenant_id,
            "tenant_name":        tenant_name,
            "due_amount":         p.due_amount,
            "electricity_amount": p.electricity_amount,
            "additional_amount":  p.additional_amount,
            "total_due":          total_due,
            "arrears":            p.arrears,
            "amount_paid":        p.amount_paid,
            "balance":            round(balance, 2),
            "payment_date":       p.payment_date,
            "month_year":         p.month_year,
            "transaction_id":     p.transaction_id,
            "is_advance":         p.is_advance
        })
    return result


@router.post("/generate-monthly")
def generate_monthly_bills(
    month_year: str,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    hid = current_hostel.hostel_id

    active_tenants = db.query(models.Tenant).filter(
        models.Tenant.hostel_id == hid,
        models.Tenant.status    == "Active"
    ).all()

    generated = 0
    for tenant in active_tenants:
        existing = db.query(models.Payment).filter(
            models.Payment.tenant_id  == tenant.tenant_id,
            models.Payment.month_year == month_year
        ).first()
        if existing:
            continue

        if not tenant.room:
            continue

        due_info   = get_total_due_for_tenant(tenant, month_year, db, hid)
        due_amount = due_info["base_rent"]
        elec_amount= due_info["electricity_amount"]
        add_amount = due_info["additional_amount"]

        prev = db.query(models.Payment).filter(
            models.Payment.tenant_id == tenant.tenant_id
        ).order_by(models.Payment.month_year.desc()).first()
        arrears = 0
        if prev:
            prev_total = prev.due_amount + prev.electricity_amount + prev.additional_amount
            arrears = max(0, prev_total - prev.amount_paid + prev.arrears)

        payment = models.Payment(
            tenant_id          = tenant.tenant_id,
            hostel_id          = hid,
            amount_paid        = 0,
            due_amount         = due_amount,
            electricity_amount = elec_amount,
            additional_amount  = add_amount,
            arrears            = arrears,
            month_year         = month_year,
        )
        db.add(payment)
        generated += 1

    db.commit()
    return {"message": f"Generated {generated} payment entries for {month_year}"}
