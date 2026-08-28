"""Payment ledger, tenant UPI requests, verification and reminder workflows."""

from datetime import date, datetime
from io import BytesIO
import os
import secrets
from typing import Optional
from urllib.parse import quote, urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app import models, schemas
from app.auth import get_current_hostel
from app.billing import (
    charge_breakdown, money, month_bounds, payment_snapshot, payment_snapshots,
    signed_balance_before, tenant_account_totals, tenant_is_billable,
)
from app.database import get_db

router = APIRouter()


def _due_date(month_year: str, hostel: Optional[models.Hostel]) -> date:
    month_start, month_end = month_bounds(month_year)
    due_day = max(1, min((hostel.payment_due_day if hostel else 5) or 5, month_end.day))
    return date(month_start.year, month_start.month, due_day)


def _tenant(db: Session, hostel_id: int, tenant_id: int) -> models.Tenant:
    tenant = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == tenant_id,
        models.Tenant.hostel_id == hostel_id,
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def _ensure_ledger(
    db: Session, hostel_id: int, tenant: models.Tenant, month_year: str,
    refresh_charges: bool = False,
) -> models.Payment:
    month_bounds(month_year)
    if not tenant_is_billable(tenant, month_year):
        raise HTTPException(status_code=422, detail="Tenant was not staying in the hostel during this billing month")
    if not tenant.room:
        raise HTTPException(status_code=422, detail="Assign a room before generating a bill")

    ledger = db.query(models.Payment).filter(
        models.Payment.hostel_id == hostel_id,
        models.Payment.tenant_id == tenant.tenant_id,
        models.Payment.month_year == month_year,
    ).with_for_update().first()
    opening = signed_balance_before(db, hostel_id, tenant.tenant_id, month_year)
    if ledger is None:
        breakdown = charge_breakdown(tenant, month_year, db, hostel_id)
        ledger = models.Payment(
            tenant_id=tenant.tenant_id, hostel_id=hostel_id,
            amount_paid=0, month_year=month_year,
        )
        db.add(ledger)
        ledger.due_amount = breakdown["rent"]
        ledger.electricity_amount = breakdown["electricity"]
        ledger.additional_amount = breakdown["additional"]
    elif refresh_charges and not ledger.amount_paid:
        breakdown = charge_breakdown(tenant, month_year, db, hostel_id)
        ledger.due_amount = breakdown["rent"]
        ledger.electricity_amount = breakdown["electricity"]
        ledger.additional_amount = breakdown["additional"]
    ledger.arrears = money(max(0, opening))
    db.flush()
    return ledger


def _serialize_payment(db: Session, payment: models.Payment, snapshot: Optional[dict] = None) -> dict:
    snapshot = snapshot or payment_snapshot(db, payment)
    tenant = payment.tenant
    due_date = _due_date(payment.month_year, payment.hostel)
    return {
        "payment_id": payment.payment_id,
        "tenant_id": payment.tenant_id,
        "tenant_name": tenant.name if tenant else f"Tenant #{payment.tenant_id}",
        "tenant_phone": tenant.phone if tenant else "",
        "room_number": tenant.room.room_number if tenant and tenant.room else None,
        "due_amount": money(payment.due_amount),
        "electricity_amount": money(payment.electricity_amount),
        "additional_amount": money(payment.additional_amount),
        "total_due": snapshot["current_charges"],
        "arrears": snapshot["opening_balance"],
        "opening_credit": snapshot["opening_credit"],
        "payable": snapshot["payable"],
        "amount_paid": snapshot["amount_paid"],
        "balance": snapshot["balance"],
        "credit": snapshot["credit"],
        "status": snapshot["status"],
        "due_date": due_date,
        "is_overdue": snapshot["balance"] > 0 and due_date < date.today(),
        "payment_date": payment.payment_date,
        "month_year": payment.month_year,
        "transaction_id": payment.transaction_id,
        "is_advance": payment.is_advance,
    }


def _record_received(
    db: Session, hostel_id: int, tenant: models.Tenant, month_year: str,
    amount: float, reference: Optional[str], note: Optional[str], source: str,
) -> tuple[models.Payment, models.PaymentTransaction]:
    amount = money(amount)
    if amount <= 0:
        raise HTTPException(status_code=422, detail="Payment amount must be greater than zero")
    if reference:
        duplicate = db.query(models.PaymentTransaction).filter(
            models.PaymentTransaction.hostel_id == hostel_id,
            models.PaymentTransaction.transaction_id == reference,
            models.PaymentTransaction.status == "RECEIVED",
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="This transaction reference is already recorded")

    ledger = _ensure_ledger(db, hostel_id, tenant, month_year)
    ledger.amount_paid = money(ledger.amount_paid + amount)
    ledger.payment_date = datetime.utcnow()
    ledger.transaction_id = reference or ledger.transaction_id
    transaction = models.PaymentTransaction(
        tenant_id=tenant.tenant_id, hostel_id=hostel_id, payment_id=ledger.payment_id,
        amount=amount, month_year=month_year, transaction_id=reference, note=note,
        status="RECEIVED", source=source, paid_at=datetime.utcnow(),
    )
    db.add(transaction)
    db.flush()
    return ledger, transaction


def _public_origin() -> str:
    return os.getenv("FRONTEND_PUBLIC_URL", "http://localhost:5173").rstrip("/")


def _request_payload(request: models.PaymentRequest) -> dict:
    tenant = request.tenant
    hostel = tenant.hostel if tenant else None
    note = f"{request.month_year} rent - {tenant.name} - {tenant.phone}"
    params = {
        "pa": (hostel.upi_id if hostel else None) or os.getenv("UPI_ID", ""),
        "pn": (hostel.name if hostel else "Smart Stay")[:50],
        "am": f"{request.requested_amount:.2f}", "cu": "INR",
        "tn": note[:80], "tr": f"SSR{request.request_id}",
    }
    upi_url = "upi://pay?" + urlencode(params)
    due_date = _due_date(request.month_year, hostel)
    return {
        "request_id": request.request_id, "public_token": request.public_token,
        "tenant_id": request.tenant_id, "tenant_name": tenant.name if tenant else "",
        "tenant_phone": tenant.phone if tenant else "",
        "room_number": tenant.room.room_number if tenant and tenant.room else None,
        "hostel_name": hostel.name if hostel else "Smart Stay",
        "month_year": request.month_year, "amount": money(request.requested_amount),
        "due_date": due_date,
        "status": request.status, "payer_reference": request.payer_reference,
        "failure_reason": request.failure_reason, "upi_configured": bool(params["pa"]),
        "upi_url": upi_url if params["pa"] else None,
        "qr_image_url": f"/api/payments/payment-request/{request.public_token}/qr" if params["pa"] else None,
        "public_url": f"{_public_origin()}/pay/{request.public_token}",
        "receipt_url": f"/api/invoice/payment-request/{request.public_token}/download" if request.status == "VERIFIED" else None,
        "created_at": request.created_at, "updated_at": request.updated_at,
    }


def _create_or_reuse_request(
    db: Session, hostel_id: int, tenant: models.Tenant, month_year: str,
    requested_amount: Optional[float] = None,
) -> models.PaymentRequest:
    ledger = _ensure_ledger(db, hostel_id, tenant, month_year)
    snapshot = payment_snapshot(db, ledger)
    amount = money(requested_amount if requested_amount is not None else snapshot["balance"])
    if amount <= 0:
        raise HTTPException(status_code=409, detail="This bill is already fully paid")
    existing = db.query(models.PaymentRequest).filter(
        models.PaymentRequest.hostel_id == hostel_id,
        models.PaymentRequest.tenant_id == tenant.tenant_id,
        models.PaymentRequest.month_year == month_year,
        models.PaymentRequest.requested_amount == amount,
        models.PaymentRequest.status.in_(["PENDING", "SUBMITTED"]),
    ).order_by(models.PaymentRequest.request_id.desc()).first()
    if existing:
        return existing
    request = models.PaymentRequest(
        tenant_id=tenant.tenant_id, hostel_id=hostel_id, payment_id=ledger.payment_id,
        public_token=secrets.token_urlsafe(32), month_year=month_year,
        requested_amount=amount, status="PENDING",
    )
    db.add(request)
    db.flush()
    return request


@router.post("/", status_code=201)
def record_payment(
    payload: schemas.PaymentCreate, db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel),
):
    tenant = _tenant(db, current_hostel.hostel_id, payload.tenant_id)
    ledger, transaction = _record_received(
        db, current_hostel.hostel_id, tenant, payload.month_year, payload.amount_paid,
        payload.transaction_id, payload.note, "MANUAL",
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A payment was updated at the same time. Refresh and retry.") from exc
    db.refresh(ledger)
    result = _serialize_payment(db, ledger)
    result.update({"message": "Payment recorded and receipt is ready", "txn_id": transaction.txn_id})
    return result


@router.get("/")
def list_payments(
    month_year: Optional[str] = None, db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel),
):
    query = db.query(models.Payment).filter(models.Payment.hostel_id == current_hostel.hostel_id)
    if month_year:
        month_bounds(month_year)
        query = query.filter(models.Payment.month_year == month_year)
    rows = query.order_by(models.Payment.month_year.desc(), models.Payment.payment_id.desc()).all()
    snapshots = payment_snapshots(db, rows)
    return [_serialize_payment(db, row, snapshots[row.payment_id]) for row in rows]


@router.get("/transactions")
def list_transactions(
    tenant_id: Optional[int] = None, month_year: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500), db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel),
):
    query = db.query(models.PaymentTransaction).filter(
        models.PaymentTransaction.hostel_id == current_hostel.hostel_id
    )
    if tenant_id:
        query = query.filter(models.PaymentTransaction.tenant_id == tenant_id)
    if month_year:
        month_bounds(month_year)
        query = query.filter(models.PaymentTransaction.month_year == month_year)
    rows = query.order_by(models.PaymentTransaction.paid_at.desc()).limit(limit).all()
    return [{
        "txn_id": row.txn_id, "tenant_id": row.tenant_id,
        "tenant_name": row.tenant.name if row.tenant else f"#{row.tenant_id}",
        "amount": money(row.amount), "month_year": row.month_year,
        "transaction_id": row.transaction_id, "note": row.note,
        "status": row.status, "source": row.source, "paid_at": row.paid_at,
    } for row in rows]


@router.get("/ledger/{tenant_id}")
def get_tenant_ledger(
    tenant_id: int, db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel),
):
    tenant = _tenant(db, current_hostel.hostel_id, tenant_id)
    rows = db.query(models.Payment).filter(
        models.Payment.hostel_id == current_hostel.hostel_id,
        models.Payment.tenant_id == tenant_id,
    ).order_by(models.Payment.month_year.asc()).all()
    totals = tenant_account_totals(db, current_hostel.hostel_id, tenant_id)
    snapshots = payment_snapshots(db, rows)
    return {
        "tenant_id": tenant_id, "tenant_name": tenant.name, **totals,
        "summary": f"Billed ₹{totals['total_billed']:,.2f} · Paid ₹{totals['total_paid']:,.2f} · Remaining ₹{totals['outstanding']:,.2f}",
        "monthly_records": [_serialize_payment(db, row, snapshots[row.payment_id]) for row in rows],
    }


@router.post("/generate-monthly")
def generate_monthly_bills(
    month_year: str, db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel),
):
    month_bounds(month_year)
    tenants = db.query(models.Tenant).filter(models.Tenant.hostel_id == current_hostel.hostel_id).all()
    generated = updated = skipped = 0
    for tenant in tenants:
        if not tenant.room or not tenant_is_billable(tenant, month_year):
            skipped += 1
            continue
        existed = db.query(models.Payment.payment_id).filter(
            models.Payment.hostel_id == current_hostel.hostel_id,
            models.Payment.tenant_id == tenant.tenant_id,
            models.Payment.month_year == month_year,
        ).first()
        _ensure_ledger(db, current_hostel.hostel_id, tenant, month_year, refresh_charges=True)
        if existed: updated += 1
        else: generated += 1
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Bills were generated concurrently. Refresh and retry.") from exc
    return {"message": f"{month_year}: {generated} bills created, {updated} refreshed", "generated": generated, "updated": updated, "skipped": skipped}


@router.post("/payment-requests", status_code=201)
def create_payment_request(
    payload: schemas.PaymentRequestCreate, db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel),
):
    tenant = _tenant(db, current_hostel.hostel_id, payload.tenant_id)
    request = _create_or_reuse_request(db, current_hostel.hostel_id, tenant, payload.month_year, payload.amount)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A payment request already exists. Refresh and retry.") from exc
    db.refresh(request)
    return _request_payload(request)


@router.get("/payment-requests")
def list_payment_requests(
    month_year: Optional[str] = None, status: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500), db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel),
):
    query = db.query(models.PaymentRequest).filter(models.PaymentRequest.hostel_id == current_hostel.hostel_id)
    if month_year:
        month_bounds(month_year)
        query = query.filter(models.PaymentRequest.month_year == month_year)
    if status:
        query = query.filter(models.PaymentRequest.status == status.upper())
    return [_request_payload(row) for row in query.order_by(models.PaymentRequest.request_id.desc()).limit(limit).all()]


@router.get("/payment-request/{public_token}")
def public_payment_request(public_token: str, db: Session = Depends(get_db)):
    request = db.query(models.PaymentRequest).filter(models.PaymentRequest.public_token == public_token).first()
    if not request:
        raise HTTPException(status_code=404, detail="Payment request not found")
    return _request_payload(request)


@router.get("/payment-request/{public_token}/qr")
def payment_request_qr(public_token: str, db: Session = Depends(get_db)):
    request = db.query(models.PaymentRequest).filter(models.PaymentRequest.public_token == public_token).first()
    if not request:
        raise HTTPException(status_code=404, detail="Payment request not found")
    payload = _request_payload(request)
    if not payload["upi_url"]:
        raise HTTPException(status_code=409, detail="Admin must configure a UPI ID first")
    try:
        import qrcode
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="QR support is not installed") from exc
    image = qrcode.make(payload["upi_url"])
    output = BytesIO()
    image.save(output, format="PNG")
    return Response(output.getvalue(), media_type="image/png", headers={"Cache-Control": "private, max-age=300"})


@router.post("/payment-request/{public_token}/submit")
def submit_payment_reference(
    public_token: str, payload: schemas.PaymentRequestSubmit, db: Session = Depends(get_db),
):
    request = db.query(models.PaymentRequest).filter(models.PaymentRequest.public_token == public_token).with_for_update().first()
    if not request:
        raise HTTPException(status_code=404, detail="Payment request not found")
    if request.status == "VERIFIED": return _request_payload(request)
    if request.status == "FAILED":
        raise HTTPException(status_code=409, detail="This payment request was marked failed")
    request.payer_reference = payload.payer_reference.strip()
    request.status = "SUBMITTED"
    request.failure_reason = None
    db.commit()
    db.refresh(request)
    return _request_payload(request)


@router.patch("/payment-requests/{request_id}/review")
def review_payment_request(
    request_id: int, payload: schemas.PaymentRequestReview,
    db: Session = Depends(get_db), current_hostel: models.Hostel = Depends(get_current_hostel),
):
    request = db.query(models.PaymentRequest).filter(
        models.PaymentRequest.request_id == request_id,
        models.PaymentRequest.hostel_id == current_hostel.hostel_id,
    ).with_for_update().first()
    if not request:
        raise HTTPException(status_code=404, detail="Payment request not found")
    status = payload.status.upper()
    if status not in {"VERIFIED", "FAILED"}:
        raise HTTPException(status_code=422, detail="Status must be VERIFIED or FAILED")
    if request.status == "VERIFIED": return _request_payload(request)
    if status == "FAILED":
        request.status = "FAILED"
        request.failure_reason = payload.failure_reason or "Payment could not be verified"
    else:
        if not request.payer_reference:
            raise HTTPException(status_code=422, detail="Tenant must submit the UPI reference before verification")
        tenant = _tenant(db, current_hostel.hostel_id, request.tenant_id)
        _record_received(
            db, current_hostel.hostel_id, tenant, request.month_year, request.requested_amount,
            request.payer_reference, f"Verified payment request #{request.request_id}", "UPI_REQUEST",
        )
        request.status = "VERIFIED"
        request.verified_at = datetime.utcnow()
        request.failure_reason = None
    db.commit()
    db.refresh(request)
    return _request_payload(request)


@router.post("/reminders/{month_year}")
def prepare_monthly_reminders(
    month_year: str, db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel),
):
    month_bounds(month_year)
    ledgers = db.query(models.Payment).filter(
        models.Payment.hostel_id == current_hostel.hostel_id,
        models.Payment.month_year == month_year,
    ).all()
    snapshots = payment_snapshots(db, ledgers)
    existing_requests = db.query(models.PaymentRequest).filter(
        models.PaymentRequest.hostel_id == current_hostel.hostel_id,
        models.PaymentRequest.month_year == month_year,
        models.PaymentRequest.status.in_(["PENDING", "SUBMITTED"]),
    ).all()
    request_map = {
        (request.tenant_id, money(request.requested_amount)): request
        for request in existing_requests
    }
    reminders = []
    for ledger in ledgers:
        snapshot = snapshots[ledger.payment_id]
        if snapshot["balance"] <= 0 or not ledger.tenant: continue
        request = request_map.get((ledger.tenant_id, snapshot["balance"]))
        if request is None:
            request = models.PaymentRequest(
                tenant_id=ledger.tenant_id, hostel_id=current_hostel.hostel_id,
                payment_id=ledger.payment_id, public_token=secrets.token_urlsafe(32),
                month_year=month_year, requested_amount=snapshot["balance"], status="PENDING",
            )
            db.add(request)
            db.flush()
            request_map[(ledger.tenant_id, snapshot["balance"])] = request
        data = _request_payload(request)
        message = (
            f"Hi {ledger.tenant.name}, your {month_year} Smart Stay bill has "
            f"₹{snapshot['balance']:,.2f} remaining, due by {data['due_date'].strftime('%d %b %Y')}. "
            f"Pay securely here: {data['public_url']}"
        )
        phone = "".join(ch for ch in ledger.tenant.phone if ch.isdigit())
        if len(phone) == 10: phone = "91" + phone
        reminders.append({**data, "message": message, "whatsapp_url": f"https://wa.me/{phone}?text={quote(message)}"})
    db.commit()
    return {"month_year": month_year, "count": len(reminders), "reminders": reminders}
