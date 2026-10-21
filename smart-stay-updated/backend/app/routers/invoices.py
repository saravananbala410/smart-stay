"""
routers/invoices.py - FIX #9: PDF Invoice / Receipt Generation
FIX: Uses a signed token instead of JWT auth so it can be opened in a new browser tab.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from io import BytesIO
import hmac, hashlib, os, time

from app.database import get_db
from app import models
from app.auth import get_current_hostel
from app.billing import allocated_share, money, month_bounds, payment_snapshot, tenant_is_billable

router = APIRouter()

# ── token helpers ──────────────────────────────────────────────────────────
_SECRET = os.getenv("SECRET_KEY", "smartstay-invoice-secret")

def _make_token(hostel_id: int, tenant_id: int, month_year: str, expires: int) -> str:
    msg = f"{hostel_id}:{tenant_id}:{month_year}:{expires}"
    return hmac.new(_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()[:16]

def _verify_token(hostel_id: int, tenant_id: int, month_year: str, expires: int, token: str) -> bool:
    return expires >= int(time.time()) and hmac.compare_digest(
        _make_token(hostel_id, tenant_id, month_year, expires), token
    )


# ── endpoint to get a shareable invoice token ──────────────────────────────
@router.get("/token/{tenant_id}")
def get_invoice_token(
    tenant_id: int,
    month_year: str = Query(...),
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    """Return a short-lived token the frontend can append to the invoice URL."""
    tenant = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == tenant_id,
        models.Tenant.hostel_id == current_hostel.hostel_id
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    month_bounds(month_year)
    expires = int(time.time()) + 15 * 60
    token = _make_token(current_hostel.hostel_id, tenant_id, month_year, expires)
    return {"token": token, "expires": expires, "hostel_id": current_hostel.hostel_id}


# ── public invoice endpoint (no auth header, uses token) ───────────────────
@router.get("/view/{hostel_id}/{tenant_id}/{month_year}", response_class=HTMLResponse)
def generate_invoice(
    hostel_id: int,
    tenant_id: int,
    month_year: str,
    token: str = Query(...),
    expires: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    FIX: Public endpoint — browser can open directly in new tab.
    Authenticated via HMAC token (not JWT) so no auth header is needed.
    """
    month_bounds(month_year)
    if not _verify_token(hostel_id, tenant_id, month_year, expires, token):
        raise HTTPException(status_code=403, detail="Invalid or expired invoice token")

    hostel = db.query(models.Hostel).filter(models.Hostel.hostel_id == hostel_id).first()
    if not hostel:
        raise HTTPException(status_code=404, detail="Hostel not found")

    tenant = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == tenant_id,
        models.Tenant.hostel_id == hostel_id
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    payment = db.query(models.Payment).filter(
        models.Payment.hostel_id == hostel_id,
        models.Payment.tenant_id  == tenant_id,
        models.Payment.month_year == month_year
    ).first()

    snapshot = payment_snapshot(db, payment) if payment else {
        "opening_balance": 0, "opening_credit": 0, "payable": 0,
        "amount_paid": 0, "balance": 0, "credit": 0,
    }
    rent_amt  = payment.due_amount if payment else 0
    elec_amt  = payment.electricity_amount if payment else 0
    add_amt   = payment.additional_amount if payment else 0
    arrears   = snapshot["opening_balance"]
    opening_credit = snapshot["opening_credit"]
    total_due = snapshot["payable"]
    paid      = snapshot["amount_paid"]
    # Receipts show the month's true remainder, even if it moved to the next bill.
    balance   = money(snapshot["balance"] + snapshot.get("carried_forward", 0))

    add_charges = db.query(models.AdditionalCharge).filter(
        models.AdditionalCharge.hostel_id  == hostel_id,
        models.AdditionalCharge.month_year == month_year
    ).all()

    add_rows = ""
    hostel_tenants = db.query(models.Tenant).filter(models.Tenant.hostel_id == hostel_id).all()
    for ac in add_charges:
        if ac.room_number and (not tenant.room or ac.room_number != tenant.room.room_number):
            continue
        eligible_ids = [
            t.tenant_id for t in hostel_tenants
            if t.room and tenant_is_billable(t, month_year)
            and (ac.room_number is None or (t.room and t.room.room_number == ac.room_number))
        ]
        tenant_share = allocated_share(ac.total_amount, eligible_ids, tenant_id)
        scope = f"Room {ac.room_number}" if ac.room_number else "Hostel-wide"
        add_rows += f"""
        <tr>
          <td class="item">{ac.charge_name} <span class="note">({scope})</span></td>
          <td class="amt">₹{tenant_share:,.2f}</td>
        </tr>"""

    payment_date_str = (
        payment.payment_date.strftime("%d %b %Y, %I:%M %p")
        if payment and payment.payment_date else datetime.now().strftime("%d %b %Y")
    )
    badge_color = "#16a34a" if balance == 0 else "#dc2626"
    status_badge = "PAID IN FULL" if balance == 0 else f"BALANCE DUE ₹{balance:,.2f}"

    txn_rows = db.query(models.PaymentTransaction).filter(
        models.PaymentTransaction.hostel_id == hostel_id,
        models.PaymentTransaction.tenant_id == tenant_id,
        models.PaymentTransaction.month_year == month_year
    ).order_by(models.PaymentTransaction.paid_at.asc()).all()

    txn_html = "".join([
        f'<div class="txn-item"><span>#{t.txn_id} — {t.paid_at.strftime("%d %b %Y %H:%M") if t.paid_at else "—"}{(" · " + t.note) if t.note else ""}</span>'
        f'<span style="color:#16a34a;font-weight:600">₹{t.amount:,.2f}</span></div>'
        for t in txn_rows
    ]) or '<p style="color:#94a3b8;font-size:12px;padding:8px 0">No payment recorded yet.</p>'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Invoice – {tenant.name} – {month_year}</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:24px;color:#1e293b}}
  .card{{max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)}}
  .header{{background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;padding:28px 32px 20px}}
  .header h1{{font-size:22px;font-weight:700}}
  .header p{{font-size:12px;opacity:.8;margin-top:4px}}
  .header .addr{{font-size:11px;opacity:.7;margin-top:6px}}
  .badge{{display:inline-block;margin-top:10px;padding:4px 14px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(255,255,255,.2);letter-spacing:.5px}}
  .meta{{display:flex;justify-content:space-between;padding:20px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px}}
  .meta .col{{display:flex;flex-direction:column;gap:4px}}
  .label{{color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.5px}}
  .value{{font-weight:600;color:#1e293b}}
  .status-bar{{padding:12px 32px;font-size:13px;font-weight:600;display:flex;justify-content:space-between;align-items:center;
    background:{badge_color}18;border-bottom:2px solid {badge_color}40;color:{badge_color}}}
  .body{{padding:24px 32px}}
  .sec-title{{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;font-weight:600;margin-bottom:10px}}
  table{{width:100%;border-collapse:collapse;font-size:14px}}
  th{{text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;padding:8px 4px;border-bottom:2px solid #e2e8f0}}
  th:last-child{{text-align:right}}
  td.item{{padding:12px 4px;border-bottom:1px solid #f1f5f9}}
  td.amt{{text-align:right;padding:12px 4px;border-bottom:1px solid #f1f5f9;font-weight:500}}
  .note{{font-size:11px;color:#94a3b8}}
  .total-row td{{padding:14px 4px;font-weight:700;font-size:15px;border-top:2px solid #e2e8f0}}
  .paid-row td{{color:#16a34a}}
  .balance-row td{{color:{badge_color};font-size:16px}}
  .txn-item{{display:flex;justify-content:space-between;font-size:12px;padding:8px 0;border-bottom:1px dashed #f1f5f9;color:#475569}}
  .footer{{padding:16px 32px;text-align:center;font-size:11px;color:#94a3b8;background:#f8fafc}}
  .print-btn{{display:block;margin:16px auto;padding:10px 28px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}}
  @media print{{.print-btn{{display:none}}body{{background:#fff;padding:0}}.card{{box-shadow:none;border-radius:0}}}}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>🏠 {hostel.name}</h1>
    <p>Rent Invoice &amp; Receipt</p>
    {f'<p class="addr">📍 {hostel.address}</p>' if hostel.address else ''}
    <div class="badge">{status_badge}</div>
  </div>
  <div class="meta">
    <div class="col">
      <span class="label">Tenant</span><span class="value">{tenant.name}</span>
      <span class="label" style="margin-top:8px">Room</span>
      <span class="value">{tenant.room.room_number if tenant.room else 'N/A'}</span>
    </div>
    <div class="col" style="text-align:right">
      <span class="label">Billing Period</span><span class="value">{month_year}</span>
      <span class="label" style="margin-top:8px">Invoice Date</span>
      <span class="value">{payment_date_str}</span>
    </div>
  </div>
  <div class="status-bar">
    <span>{'✅ All dues cleared for '+month_year if balance==0 else '⚠ Outstanding for '+month_year}</span>
    <span style="font-size:16px">₹{balance:,.2f} pending</span>
  </div>
  <div class="body">
    <p class="sec-title">Charge Breakdown</p>
    <table>
      <thead><tr><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td class="item">Base Room Rent <span class="note">({month_year})</span></td><td class="amt">₹{rent_amt:,.2f}</td></tr>
        <tr><td class="item">Electricity Charges <span class="note">(split per room)</span></td><td class="amt">₹{elec_amt:,.2f}</td></tr>
        {add_rows if add_rows else f'<tr><td class="item">Additional Services</td><td class="amt">₹{add_amt:,.2f}</td></tr>'}
        {f'<tr><td class="item">Previous Arrears</td><td class="amt" style="color:#f59e0b">₹{arrears:,.2f}</td></tr>' if arrears>0 else ''}
        {f'<tr><td class="item">Opening Credit</td><td class="amt" style="color:#16a34a">−₹{opening_credit:,.2f}</td></tr>' if opening_credit>0 else ''}
        <tr class="total-row"><td>Total Due</td><td class="amt">₹{total_due:,.2f}</td></tr>
        <tr class="paid-row"><td>Amount Paid</td><td class="amt">₹{paid:,.2f}</td></tr>
        <tr class="balance-row"><td>Outstanding Balance</td><td class="amt">₹{balance:,.2f}</td></tr>
      </tbody>
    </table>
    <div style="margin-top:20px">
      <p class="sec-title">Payment Transactions</p>
      {txn_html}
    </div>
  </div>
  <div class="footer">
    Generated by Smart-Stay PG Management System · {datetime.now().strftime("%d %b %Y %H:%M")}<br>
    Computer-generated invoice — no physical signature required.
  </div>
</div>
<button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
</body>
</html>"""

    return HTMLResponse(content=html)


@router.get("/download/{hostel_id}/{tenant_id}/{month_year}")
def download_receipt_pdf(
    hostel_id: int,
    tenant_id: int,
    month_year: str,
    token: str = Query(...),
    expires: int = Query(...),
    db: Session = Depends(get_db),
):
    """Download a real PDF receipt/statement for the selected billing month."""
    month_bounds(month_year)
    if not _verify_token(hostel_id, tenant_id, month_year, expires, token):
        raise HTTPException(status_code=403, detail="Invalid or expired receipt token")
    hostel = db.query(models.Hostel).filter(models.Hostel.hostel_id == hostel_id).first()
    tenant = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == tenant_id,
        models.Tenant.hostel_id == hostel_id,
    ).first()
    payment = db.query(models.Payment).filter(
        models.Payment.hostel_id == hostel_id,
        models.Payment.tenant_id == tenant_id,
        models.Payment.month_year == month_year,
    ).first()
    if not hostel or not tenant or not payment:
        raise HTTPException(status_code=404, detail="Receipt data not found")

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="PDF support is not installed") from exc

    snapshot = payment_snapshot(db, payment)
    transactions = db.query(models.PaymentTransaction).filter(
        models.PaymentTransaction.hostel_id == hostel_id,
        models.PaymentTransaction.tenant_id == tenant_id,
        models.PaymentTransaction.month_year == month_year,
        models.PaymentTransaction.status == "RECEIVED",
    ).order_by(models.PaymentTransaction.paid_at.asc()).all()

    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4)
    width, height = A4
    pdf.setTitle(f"Smart Stay Receipt - {tenant.name} - {month_year}")
    pdf.setFillColorRGB(0.04, 0.25, 0.27)
    pdf.rect(0, height - 105, width, 105, fill=1, stroke=0)
    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(42, height - 53, hostel.name)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(42, height - 73, "SMART STAY PAYMENT RECEIPT")
    pdf.drawRightString(width - 42, height - 53, month_year)

    y = height - 145
    pdf.setFillColorRGB(0.08, 0.12, 0.16)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(42, y, "Tenant details")
    y -= 23
    pdf.setFont("Helvetica", 10)
    pdf.drawString(42, y, f"Name: {tenant.name}")
    pdf.drawString(300, y, f"Phone: {tenant.phone}")
    y -= 18
    room_number = tenant.room.room_number if tenant.room else "Not assigned"
    pdf.drawString(42, y, f"Room: {room_number}")
    pdf.drawString(300, y, f"Receipt ID: SS-{payment.payment_id}-{month_year.replace('-', '')}")

    y -= 38
    rows = [
        ("Room rent", payment.due_amount),
        ("Electricity", payment.electricity_amount),
        ("Other charges", payment.additional_amount),
        ("Previous balance", snapshot["opening_balance"]),
        ("Less: opening credit", snapshot["opening_credit"]),
        ("Total payable", snapshot["payable"]),
        ("Amount received", snapshot["amount_paid"]),
        ("Remaining", money(snapshot["balance"] + snapshot.get("carried_forward", 0))),
    ]
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(42, y, "Payment calculation")
    y -= 16
    pdf.line(42, y, width - 42, y)
    for label, amount in rows:
        y -= 24
        pdf.setFont("Helvetica-Bold" if label in {"Total payable", "Remaining"} else "Helvetica", 10)
        pdf.drawString(48, y, label)
        pdf.drawRightString(width - 48, y, f"INR {amount:,.2f}")
    y -= 16
    pdf.line(42, y, width - 42, y)

    y -= 34
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(42, y, "Verified transactions")
    pdf.setFont("Helvetica", 9)
    if not transactions:
        y -= 22
        pdf.drawString(48, y, "No payment transaction recorded for this month.")
    for transaction in transactions[:12]:
        y -= 21
        paid_at = transaction.paid_at.strftime("%d %b %Y, %I:%M %p") if transaction.paid_at else "-"
        reference = transaction.transaction_id or "Cash / manual"
        pdf.drawString(48, y, f"{paid_at}  |  {reference}")
        pdf.drawRightString(width - 48, y, f"INR {transaction.amount:,.2f}")

    pdf.setFont("Helvetica", 8)
    pdf.setFillColorRGB(0.35, 0.4, 0.45)
    pdf.drawCentredString(width / 2, 34, f"Generated {datetime.now().strftime('%d %b %Y %H:%M')} - Computer generated receipt")
    pdf.save()
    output.seek(0)
    safe_name = "".join(ch for ch in tenant.name if ch.isalnum() or ch in "-_ ").strip().replace(" ", "-")
    filename = f"SmartStay-{safe_name or tenant_id}-{month_year}-receipt.pdf"
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/payment-request/{public_token}/download")
def download_verified_request_receipt(public_token: str, db: Session = Depends(get_db)):
    request = db.query(models.PaymentRequest).filter(
        models.PaymentRequest.public_token == public_token
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Payment request not found")
    if request.status != "VERIFIED":
        raise HTTPException(status_code=409, detail="Receipt is available after payment verification")
    expires = int(time.time()) + 60
    token = _make_token(request.hostel_id, request.tenant_id, request.month_year, expires)
    return download_receipt_pdf(
        request.hostel_id, request.tenant_id, request.month_year,
        token=token, expires=expires, db=db,
    )
