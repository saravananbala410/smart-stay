"""
routers/payments.py - Payment recording
FIX #1: Tenant-wise ledger with dynamic due calculation from joining_date
FIX #3: Every payment creates a new PaymentTransaction row (individual logs)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import List, Optional
import calendar

from app.database import get_db
from app import models, schemas
from app.auth import get_current_hostel

router = APIRouter()

# ─── Helpers ───────────────────────────────────────────────────────────────

def calc_months_active(joining_date: date, up_to_date: date) -> int:
    """Count complete billing months from joining_date up to (and including) up_to_date's month."""
    months = (up_to_date.year - joining_date.year) * 12 + (up_to_date.month - joining_date.month) + 1
    return max(0, months)

def get_total_due_for_tenant(tenant, month_year: str, db: Session, hid: int) -> dict:
    """Calculate total rent + electricity + additional charges for a tenant for a given month."""
    if tenant.room:
        rent_config = db.query(models.RentConfiguration).filter(
            models.RentConfiguration.hostel_id    == hid,
            models.RentConfiguration.sharing_type == tenant.room.sharing_type
        ).order_by(models.RentConfiguration.effective_date.desc()).first()
        base_rent = rent_config.rent_amount if rent_config else tenant.room.base_rent
    else:
        base_rent = 0

    elec_amount = 0
    if tenant.room:
        elec_bill = db.query(models.ElectricityBill).filter(
            models.ElectricityBill.hostel_id   == hid,
            models.ElectricityBill.room_number == tenant.room.room_number,
            models.ElectricityBill.month_year  == month_year
        ).first()
        if elec_bill:
            elec_amount = elec_bill.per_tenant

    # Additional charges: room-specific + hostel-wide
    add_amount = 0
    if tenant.room:
        room_charges = db.query(models.AdditionalCharge).filter(
            models.AdditionalCharge.hostel_id   == hid,
            models.AdditionalCharge.month_year  == month_year,
            models.AdditionalCharge.room_number == tenant.room.room_number
        ).all()
        add_amount += sum(ac.per_tenant for ac in room_charges)

    hostel_charges = db.query(models.AdditionalCharge).filter(
        models.AdditionalCharge.hostel_id   == hid,
        models.AdditionalCharge.month_year  == month_year,
        models.AdditionalCharge.room_number == None
    ).all()
    add_amount += sum(ac.per_tenant for ac in hostel_charges)

    return {
        "base_rent": base_rent,
        "electricity_amount": elec_amount,
        "additional_amount": round(add_amount, 2),
        "total": round(base_rent + elec_amount + add_amount, 2)
    }


# ─── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
def record_payment(
    payload: schemas.PaymentCreate,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    """Record a payment. Always logs a new PaymentTransaction row (FIX #3)."""
    hid = current_hostel.hostel_id

    tenant = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == payload.tenant_id,
        models.Tenant.hostel_id == hid
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Ensure monthly ledger row exists
    existing = db.query(models.Payment).filter(
        models.Payment.tenant_id  == payload.tenant_id,
        models.Payment.month_year == payload.month_year
    ).first()

    if existing:
        existing.amount_paid += payload.amount_paid
        existing.payment_date = datetime.utcnow()
        if payload.transaction_id:
            existing.transaction_id = payload.transaction_id
        ledger = existing
    else:
        due_info   = get_total_due_for_tenant(tenant, payload.month_year, db, hid)
        due_amount = due_info["base_rent"]
        elec_amount= due_info["electricity_amount"]
        add_amount = due_info["additional_amount"]

        prev = db.query(models.Payment).filter(
            models.Payment.tenant_id == payload.tenant_id
        ).order_by(models.Payment.month_year.desc()).first()
        arrears = 0
        if prev:
            prev_total = prev.due_amount + prev.electricity_amount + prev.additional_amount
            arrears = max(0, prev_total - prev.amount_paid + prev.arrears)

        ledger = models.Payment(
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
        db.add(ledger)
        db.flush()

    # FIX #3: Always create a unique transaction row
    txn = models.PaymentTransaction(
        tenant_id      = payload.tenant_id,
        hostel_id      = hid,
        payment_id     = ledger.payment_id,
        amount         = payload.amount_paid,
        month_year     = payload.month_year,
        transaction_id = payload.transaction_id,
        note           = payload.note,
        paid_at        = datetime.utcnow()
    )
    db.add(txn)
    db.commit()

    total_due = ledger.due_amount + ledger.electricity_amount + ledger.additional_amount
    balance   = max(0, total_due - ledger.amount_paid + ledger.arrears)
    return {
        "message":           "Payment recorded",
        "rent":              ledger.due_amount,
        "electricity":       ledger.electricity_amount,
        "additional":        ledger.additional_amount,
        "total_due":         round(total_due, 2),
        "arrears":           ledger.arrears,
        "amount_paid":       ledger.amount_paid,
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
            "total_due":          round(total_due, 2),
            "arrears":            p.arrears,
            "amount_paid":        p.amount_paid,
            "balance":            round(balance, 2),
            "payment_date":       p.payment_date,
            "month_year":         p.month_year,
            "transaction_id":     p.transaction_id,
            "is_advance":         p.is_advance
        })
    return result


@router.get("/transactions")
def list_transactions(
    tenant_id: Optional[int] = None,
    month_year: Optional[str] = None,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    """FIX #3: Return individual transaction logs — each payment is a separate row."""
    query = db.query(models.PaymentTransaction).filter(
        models.PaymentTransaction.hostel_id == current_hostel.hostel_id
    )
    if tenant_id:
        query = query.filter(models.PaymentTransaction.tenant_id == tenant_id)
    if month_year:
        query = query.filter(models.PaymentTransaction.month_year == month_year)
    txns = query.order_by(models.PaymentTransaction.paid_at.desc()).all()
    return [
        {
            "txn_id":         t.txn_id,
            "tenant_id":      t.tenant_id,
            "tenant_name":    t.tenant.name if t.tenant else f"#{t.tenant_id}",
            "amount":         t.amount,
            "month_year":     t.month_year,
            "transaction_id": t.transaction_id,
            "note":           t.note,
            "paid_at":        t.paid_at
        }
        for t in txns
    ]


@router.get("/ledger/{tenant_id}")
def get_tenant_ledger(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    """
    FIX #1: Tenant-wise ledger with dynamic outstanding balance.
    Calculates total due from joining_date → today, subtracts total paid.
    """
    hid = current_hostel.hostel_id
    tenant = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == tenant_id,
        models.Tenant.hostel_id == hid
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    today = date.today()
    months_active = calc_months_active(tenant.joining_date, today)

    # Monthly rent from config or room base
    if tenant.room:
        rent_config = db.query(models.RentConfiguration).filter(
            models.RentConfiguration.hostel_id    == hid,
            models.RentConfiguration.sharing_type == tenant.room.sharing_type
        ).order_by(models.RentConfiguration.effective_date.desc()).first()
        monthly_rent = rent_config.rent_amount if rent_config else tenant.room.base_rent
    else:
        monthly_rent = 0

    cumulative_rent_due = round(monthly_rent * months_active, 2)

    payments = db.query(models.Payment).filter(
        models.Payment.tenant_id == tenant_id
    ).order_by(models.Payment.month_year.asc()).all()

    total_paid    = round(sum(p.amount_paid for p in payments), 2)
    total_billed  = round(sum(p.due_amount + p.electricity_amount + p.additional_amount for p in payments), 2)
    outstanding   = round(max(0, cumulative_rent_due - total_paid), 2)

    # Individual transaction log
    transactions = db.query(models.PaymentTransaction).filter(
        models.PaymentTransaction.tenant_id == tenant_id
    ).order_by(models.PaymentTransaction.paid_at.desc()).all()

    return {
        "tenant_id":           tenant.tenant_id,
        "tenant_name":         tenant.name,
        "joining_date":        tenant.joining_date,
        "months_active":       months_active,
        "monthly_rent":        monthly_rent,
        "cumulative_rent_due": cumulative_rent_due,
        "total_paid":          total_paid,
        "total_billed":        total_billed,
        "outstanding_balance": outstanding,
        "summary":             f"Paid: ₹{total_paid} | Outstanding Balance: ₹{outstanding}",
        "monthly_records": [
            {
                "month_year":         p.month_year,
                "due_amount":         p.due_amount,
                "electricity_amount": p.electricity_amount,
                "additional_amount":  p.additional_amount,
                "total_due":          round(p.due_amount + p.electricity_amount + p.additional_amount, 2),
                "arrears":            p.arrears,
                "amount_paid":        p.amount_paid,
                "balance":            round(max(0, (p.due_amount + p.electricity_amount + p.additional_amount) - p.amount_paid + p.arrears), 2),
                "payment_date":       p.payment_date
            }
            for p in payments
        ],
        "transactions": [
            {
                "txn_id":         t.txn_id,
                "amount":         t.amount,
                "month_year":     t.month_year,
                "transaction_id": t.transaction_id,
                "note":           t.note,
                "paid_at":        t.paid_at
            }
            for t in transactions
        ]
    }


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
        if existing or not tenant.room:
            continue

        due_info    = get_total_due_for_tenant(tenant, month_year, db, hid)
        due_amount  = due_info["base_rent"]
        elec_amount = due_info["electricity_amount"]
        add_amount  = due_info["additional_amount"]

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
