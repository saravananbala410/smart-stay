"""
routers/invoices.py - FIX #9: PDF Invoice / Receipt Generation
FIX: Uses a signed token instead of JWT auth so it can be opened in a new browser tab.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from datetime import datetime, date
import hmac, hashlib, os

from app.database import get_db
from app import models
from app.auth import get_current_hostel

router = APIRouter()

# ── token helpers ──────────────────────────────────────────────────────────
_SECRET = os.getenv("SECRET_KEY", "smartstay-invoice-secret")

def _make_token(hostel_id: int, tenant_id: int) -> str:
    msg = f"{hostel_id}:{tenant_id}"
    return hmac.new(_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()[:16]

def _verify_token(hostel_id: int, tenant_id: int, token: str) -> bool:
    return hmac.compare_digest(_make_token(hostel_id, tenant_id), token)


# ── endpoint to get a shareable invoice token ──────────────────────────────
@router.get("/token/{tenant_id}")
def get_invoice_token(
    tenant_id: int,
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
    token = _make_token(current_hostel.hostel_id, tenant_id)
    return {"token": token, "hostel_id": current_hostel.hostel_id}


# ── public invoice endpoint (no auth header, uses token) ───────────────────
@router.get("/view/{hostel_id}/{tenant_id}/{month_year}", response_class=HTMLResponse)
def generate_invoice(
    hostel_id: int,
    tenant_id: int,
    month_year: str,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    FIX: Public endpoint — browser can open directly in new tab.
    Authenticated via HMAC token (not JWT) so no auth header is needed.
    """
    if not _verify_token(hostel_id, tenant_id, token):
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
        models.Payment.tenant_id  == tenant_id,
        models.Payment.month_year == month_year
    ).first()

    rent_amt  = payment.due_amount         if payment else 0
    elec_amt  = payment.electricity_amount if payment else 0
    add_amt   = payment.additional_amount  if payment else 0
    arrears   = payment.arrears            if payment else 0
    total_due = rent_amt + elec_amt + add_amt + arrears
    paid      = payment.amount_paid        if payment else 0
    balance   = max(0, total_due - paid)

    add_charges = db.query(models.AdditionalCharge).filter(
        models.AdditionalCharge.hostel_id  == hostel_id,
        models.AdditionalCharge.month_year == month_year
    ).all()

    add_rows = ""
    for ac in add_charges:
        scope = f"Room {ac.room_number}" if ac.room_number else "Hostel-wide"
        add_rows += f"""
        <tr>
          <td class="item">{ac.charge_name} <span class="note">({scope})</span></td>
          <td class="amt">₹{ac.per_tenant:,.2f}</td>
        </tr>"""

    payment_date_str = (
        payment.payment_date.strftime("%d %b %Y, %I:%M %p")
        if payment and payment.payment_date else datetime.now().strftime("%d %b %Y")
    )
    badge_color = "#16a34a" if balance == 0 else "#dc2626"
    status_badge = "PAID IN FULL" if balance == 0 else f"BALANCE DUE ₹{balance:,.2f}"

    txn_rows = db.query(models.PaymentTransaction).filter(
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
