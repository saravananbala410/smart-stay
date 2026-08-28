"""Canonical billing math used by payments, reports, dashboard and receipts."""

from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import re

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models

MONEY = Decimal("0.01")
MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def money(value) -> float:
    return float(Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP))


def allocated_share(total, tenant_ids: list[int], tenant_id: int) -> float:
    """Split to exact paise; earlier tenant IDs receive any one-paise remainder."""
    ordered = sorted(set(tenant_ids))
    if tenant_id not in ordered or not ordered:
        return 0.0
    total_paise = int((Decimal(str(total or 0)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    base, remainder = divmod(total_paise, len(ordered))
    index = ordered.index(tenant_id)
    return money(Decimal(base + (1 if index < remainder else 0)) / 100)


def month_bounds(month_year: str) -> tuple[date, date]:
    if not MONTH_RE.fullmatch(month_year or ""):
        raise HTTPException(status_code=422, detail="Billing month must use YYYY-MM format")
    year, month = map(int, month_year.split("-"))
    return date(year, month, 1), date(year, month, monthrange(year, month)[1])


def tenant_is_billable(tenant: models.Tenant, month_year: str) -> bool:
    month_start, month_end = month_bounds(month_year)
    return tenant.joining_date <= month_end and (
        tenant.vacated_date is None or tenant.vacated_date >= month_start
    )


def monthly_rent(tenant: models.Tenant, month_year: str, db: Session, hostel_id: int) -> float:
    if not tenant.room:
        return 0.0
    _, month_end = month_bounds(month_year)
    config = db.query(models.RentConfiguration).filter(
        models.RentConfiguration.hostel_id == hostel_id,
        models.RentConfiguration.sharing_type == tenant.room.sharing_type,
        models.RentConfiguration.effective_date <= month_end,
    ).order_by(
        models.RentConfiguration.effective_date.desc(),
        models.RentConfiguration.config_id.desc(),
    ).first()
    return money(config.rent_amount if config else tenant.room.base_rent)


def charge_breakdown(tenant: models.Tenant, month_year: str, db: Session, hostel_id: int) -> dict:
    rent = monthly_rent(tenant, month_year, db, hostel_id)
    electricity = 0.0
    if tenant.room:
        bill = db.query(models.ElectricityBill).filter(
            models.ElectricityBill.hostel_id == hostel_id,
            models.ElectricityBill.room_number == tenant.room.room_number,
            models.ElectricityBill.month_year == month_year,
        ).first()
        if bill:
            room_tenants = db.query(models.Tenant).filter(
                models.Tenant.hostel_id == hostel_id,
                models.Tenant.room_id == tenant.room_id,
            ).all()
            eligible_ids = [t.tenant_id for t in room_tenants if tenant_is_billable(t, month_year)]
            electricity = allocated_share(bill.total_amount, eligible_ids, tenant.tenant_id)

    charge_query = db.query(models.AdditionalCharge).filter(
        models.AdditionalCharge.hostel_id == hostel_id,
        models.AdditionalCharge.month_year == month_year,
    )
    charges = charge_query.all()
    room_number = tenant.room.room_number if tenant.room else None
    hostel_tenants = db.query(models.Tenant).filter(models.Tenant.hostel_id == hostel_id).all()
    additional = 0.0
    for charge in charges:
        if charge.room_number is not None and charge.room_number != room_number:
            continue
        eligible_ids = [
            t.tenant_id for t in hostel_tenants
            if tenant_is_billable(t, month_year)
            and (charge.room_number is None or (t.room and t.room.room_number == charge.room_number))
        ]
        additional += allocated_share(charge.total_amount, eligible_ids, tenant.tenant_id)
    additional = money(additional)
    return {
        "rent": rent,
        "electricity": electricity,
        "additional": additional,
        "current_charges": money(rent + electricity + additional),
    }


def signed_balance_before(db: Session, hostel_id: int, tenant_id: int, month_year: str) -> float:
    rows = db.query(models.Payment).filter(
        models.Payment.hostel_id == hostel_id,
        models.Payment.tenant_id == tenant_id,
        models.Payment.month_year < month_year,
    ).all()
    billed = sum(p.due_amount + p.electricity_amount + p.additional_amount for p in rows)
    paid = sum(p.amount_paid for p in rows)
    return money(billed - paid)


def _snapshot_with_opening(payment: models.Payment, opening: float) -> dict:
    current = money(payment.due_amount + payment.electricity_amount + payment.additional_amount)
    payable = money(current + opening)
    remaining = money(payable - payment.amount_paid)
    return {
        "opening_balance": money(max(0, opening)),
        "opening_credit": money(max(0, -opening)),
        "current_charges": current,
        "payable": money(max(0, payable)),
        "amount_paid": money(payment.amount_paid),
        "balance": money(max(0, remaining)),
        "credit": money(max(0, -remaining)),
        "status": "PAID" if remaining <= 0 else ("PARTIAL" if payment.amount_paid > 0 else "DUE"),
    }


def payment_snapshot(db: Session, payment: models.Payment) -> dict:
    opening = signed_balance_before(
        db, payment.hostel_id, payment.tenant_id, payment.month_year
    )
    return _snapshot_with_opening(payment, opening)


def payment_snapshots(db: Session, payments: list[models.Payment]) -> dict[int, dict]:
    """Bulk snapshot calculation to avoid one prior-balance query per UI row."""
    if not payments:
        return {}
    hostel_ids = {payment.hostel_id for payment in payments}
    tenant_ids = {payment.tenant_id for payment in payments}
    all_rows = db.query(models.Payment).filter(
        models.Payment.hostel_id.in_(hostel_ids),
        models.Payment.tenant_id.in_(tenant_ids),
    ).order_by(
        models.Payment.tenant_id.asc(), models.Payment.month_year.asc(),
        models.Payment.payment_id.asc(),
    ).all()
    running = {}
    opening_by_key = {}
    for row in all_rows:
        key = (row.hostel_id, row.tenant_id)
        opening_by_key[(row.hostel_id, row.tenant_id, row.month_year)] = money(running.get(key, 0))
        running[key] = money(
            running.get(key, 0)
            + row.due_amount + row.electricity_amount + row.additional_amount
            - row.amount_paid
        )
    return {
        payment.payment_id: _snapshot_with_opening(
            payment,
            opening_by_key.get((payment.hostel_id, payment.tenant_id, payment.month_year), 0),
        )
        for payment in payments
    }


def tenant_account_totals(db: Session, hostel_id: int, tenant_id: int) -> dict:
    rows = db.query(models.Payment).filter(
        models.Payment.hostel_id == hostel_id,
        models.Payment.tenant_id == tenant_id,
    ).all()
    billed = money(sum(p.due_amount + p.electricity_amount + p.additional_amount for p in rows))
    paid = money(sum(p.amount_paid for p in rows))
    signed = money(billed - paid)
    return {
        "total_billed": billed,
        "total_paid": paid,
        "outstanding": money(max(0, signed)),
        "credit": money(max(0, -signed)),
    }
