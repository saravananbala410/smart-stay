"""
routers/tenants.py - Tenant CRUD
FIX #2: Active/Vacated strict separation
FIX #4: Photo URL fully resolved — handles both old paths and new paths
FIX #6: Welcome SMS on registration
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
import os, uuid, logging

from app.database import get_db
from app import models, schemas
from app.auth import get_current_hostel
from app.billing import monthly_rent, payment_snapshots, tenant_account_totals
from app.utils.file_upload import upload_to_cloudinary

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads"
BASE_URL   = os.getenv("BASE_URL", "http://localhost:8000")


def save_file_locally(file_bytes: bytes, filename: str, subfolder: str) -> str:
    folder = os.path.join(UPLOAD_DIR, subfolder)
    os.makedirs(folder, exist_ok=True)
    ext  = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    name = f"{uuid.uuid4()}.{ext}"
    path = os.path.join(folder, name)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return f"uploads/{subfolder}/{name}"


def resolve_photo_url(photo_url: Optional[str]) -> Optional[str]:
    """
    FIX #4: Always return a fully-qualified URL.
    Handles:
      - None / empty → None
      - Already http(s) URL (Cloudinary) → as-is
      - "uploads/photos/xxx.png"  → BASE_URL/uploads/photos/xxx.png
      - "photos/xxx.png"          → BASE_URL/uploads/photos/xxx.png  (legacy path)
      - "/uploads/photos/xxx.png" → BASE_URL/uploads/photos/xxx.png
    """
    if not photo_url:
        return None
    if photo_url.startswith("http"):
        return photo_url
    # Strip leading slash
    clean = photo_url.lstrip("/")
    # If path is missing the "uploads/" prefix (legacy stored as "photos/xxx.png")
    if not clean.startswith("uploads/"):
        clean = f"uploads/{clean}"
    return f"{BASE_URL}/{clean}"


def _send_welcome_sms(tenant, hostel_name: str):
    """FIX #6: Send welcome SMS when a new tenant is registered."""
    sid   = os.getenv("TWILIO_SID")
    token = os.getenv("TWILIO_TOKEN")
    from_ = os.getenv("TWILIO_FROM")
    message = (
        f"Welcome to {hostel_name}! 🏠\n"
        f"Dear {tenant.name}, your registration is confirmed.\n"
        f"Room: {tenant.room.room_number if tenant.room else 'TBD'} | "
        f"Joining: {tenant.joining_date}\n"
        "Contact the hostel admin for any queries."
    )
    if sid and token and from_:
        try:
            from twilio.rest import Client
            client = Client(sid, token)
            phone  = tenant.phone.strip()
            if not phone.startswith("+"):
                phone = "+91" + phone
            client.messages.create(body=message, from_=from_, to=phone)
        except Exception as e:
            logger.warning("Welcome SMS failed: %s", type(e).__name__)
    else:
        logger.info("Welcome SMS skipped; provider not configured (phone suffix: %s)", tenant.phone[-4:])


@router.post("/", status_code=201)
async def create_tenant(
    background_tasks: BackgroundTasks,
    room_id          : int            = Form(...),
    name             : str            = Form(...),
    phone            : str            = Form(...),
    aadhaar_number   : str            = Form(...),
    emergency_contact: Optional[str]  = Form(None),
    joining_date     : date           = Form(...),
    photo      : Optional[UploadFile] = File(None),
    aadhaar_pdf: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    hid = current_hostel.hostel_id

    clean_name = name.strip()
    phone_digits = "".join(char for char in phone if char.isdigit())
    aadhaar_digits = "".join(char for char in aadhaar_number if char.isdigit())
    if len(clean_name) < 2:
        raise HTTPException(status_code=422, detail="Tenant name is required")
    if not 10 <= len(phone_digits) <= 15:
        raise HTTPException(status_code=422, detail="Enter a valid 10 to 15 digit phone number")
    if len(aadhaar_digits) != 12:
        raise HTTPException(status_code=422, detail="Aadhaar number must contain exactly 12 digits")
    duplicate = db.query(models.Tenant).filter(
        models.Tenant.hostel_id == hid,
        models.Tenant.aadhaar_number == aadhaar_digits,
        models.Tenant.status == "Active",
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="An active tenant with this Aadhaar number already exists")

    room = db.query(models.Room).filter(
        models.Room.room_id   == room_id,
        models.Room.hostel_id == hid
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.occupied_beds >= room.total_beds:
        raise HTTPException(status_code=400, detail="Room is full. No vacant beds.")

    photo_url = aadhaar_pdf_url = None

    if photo:
        try:
            photo_url = await upload_to_cloudinary(photo, folder="photos")
            if not photo_url or "placeholder.com" in photo_url:
                photo.file.seek(0)
                photo_bytes = await photo.read()
                photo_url = save_file_locally(photo_bytes, photo.filename or "photo.jpg", "photos")
        except Exception:
            try:
                photo_bytes = await photo.read()
            except Exception:
                photo.file.seek(0); photo_bytes = photo.file.read()
            photo_url = save_file_locally(photo_bytes, photo.filename or "photo.jpg", "photos")

    if aadhaar_pdf:
        try:
            aadhaar_pdf_url = await upload_to_cloudinary(aadhaar_pdf, folder="aadhaar")
            if not aadhaar_pdf_url or "placeholder.com" in aadhaar_pdf_url:
                aadhaar_pdf.file.seek(0)
                pdf_bytes = await aadhaar_pdf.read()
                aadhaar_pdf_url = save_file_locally(pdf_bytes, aadhaar_pdf.filename or "doc.pdf", "aadhaar")
        except Exception:
            pdf_bytes = await aadhaar_pdf.read()
            aadhaar_pdf_url = save_file_locally(pdf_bytes, aadhaar_pdf.filename or "doc.pdf", "aadhaar")

    tenant = models.Tenant(
        hostel_id=hid, room_id=room_id, name=clean_name, phone=phone_digits,
        aadhaar_number=aadhaar_digits, emergency_contact=emergency_contact,
        photo_url=photo_url, aadhaar_pdf_url=aadhaar_pdf_url,
        joining_date=joining_date, status="Active"
    )
    db.add(tenant)
    room.occupied_beds += 1
    db.commit()
    db.refresh(tenant)
    background_tasks.add_task(_send_welcome_sms, tenant, current_hostel.name)
    return {"message": "Tenant added successfully", "tenant_id": tenant.tenant_id}


@router.get("/")
def list_tenants(
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    """FIX #2: Default to Active; Vacated tab passes status=Vacated explicitly."""
    query = db.query(models.Tenant).filter(
        models.Tenant.hostel_id == current_hostel.hostel_id
    )
    if search:
        query = query.filter(
            models.Tenant.name.ilike(f"%{search}%") |
            models.Tenant.phone.ilike(f"%{search}%")
        )
    query = query.filter(models.Tenant.status == (status or "Active"))

    result = []
    for t in query.all():
        result.append({
            "tenant_id"  : t.tenant_id,
            "name"       : t.name,
            "phone"      : t.phone,
            "status"     : t.status,
            "joining_date": t.joining_date,
            "vacated_date": t.vacated_date,
            "photo_url"  : resolve_photo_url(t.photo_url),   # FIX #4
            "room"       : {"room_number": t.room.room_number, "sharing_type": t.room.sharing_type} if t.room else None
        })
    return result


@router.get("/{tenant_id}")
def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    t = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == tenant_id,
        models.Tenant.hostel_id == current_hostel.hostel_id
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return {
        "tenant_id"        : t.tenant_id,
        "name"             : t.name,
        "phone"            : t.phone,
        "aadhaar_number"   : t.aadhaar_number,
        "emergency_contact": t.emergency_contact,
        "photo_url"        : resolve_photo_url(t.photo_url),          # FIX #4
        "aadhaar_pdf_url"  : resolve_photo_url(t.aadhaar_pdf_url),
        "joining_date"     : t.joining_date,
        "vacated_date"     : t.vacated_date,
        "status"           : t.status,
        "room"             : {
            "room_id": t.room.room_id, "room_number": t.room.room_number,
            "sharing_type": t.room.sharing_type, "base_rent": t.room.base_rent
        } if t.room else None
    }


@router.patch("/{tenant_id}")
def update_tenant(
    tenant_id: int,
    payload: schemas.TenantUpdate,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    t = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == tenant_id,
        models.Tenant.hostel_id == current_hostel.hostel_id
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if payload.status == "Vacated" and t.status == "Active":
        if t.room:
            t.room.occupied_beds = max(0, t.room.occupied_beds - 1)
        t.vacated_date = date.today()
    elif payload.status == "Active" and t.status == "Vacated":
        # Re-activate tenant
        if t.room:
            if t.room.occupied_beds >= t.room.total_beds:
                raise HTTPException(status_code=409, detail="Room is full. Free a bed before re-activating this tenant.")
            t.room.occupied_beds += 1
        t.vacated_date = None

    if payload.status:
        t.status = payload.status
    if payload.phone:
        t.phone = payload.phone

    db.commit()
    return {"message": "Tenant updated successfully"}


@router.get("/{tenant_id}/payments")
def get_tenant_payments(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    hid = current_hostel.hostel_id
    t = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == tenant_id,
        models.Tenant.hostel_id == hid
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")

    payments = db.query(models.Payment).filter(
        models.Payment.tenant_id == tenant_id,
        models.Payment.hostel_id == hid
    ).order_by(models.Payment.month_year.desc()).all()
    snapshots = payment_snapshots(db, payments)

    today = date.today()
    current_monthly_rent = monthly_rent(t, today.strftime("%Y-%m"), db, hid)

    active_until = t.vacated_date or today
    months_active       = max(0, (active_until.year - t.joining_date.year) * 12 + (active_until.month - t.joining_date.month) + 1)
    cumulative_rent_due = round(sum(p.due_amount for p in payments), 2)
    totals = tenant_account_totals(db, hid, tenant_id)

    transactions = db.query(models.PaymentTransaction).filter(
        models.PaymentTransaction.tenant_id == tenant_id,
        models.PaymentTransaction.hostel_id == hid
    ).order_by(models.PaymentTransaction.paid_at.desc()).all()

    return {
        "tenant_name"         : t.name,
        "joining_date"        : t.joining_date,
        "months_active"       : months_active,
        "monthly_rent"        : current_monthly_rent,
        "cumulative_rent_due" : cumulative_rent_due,
        "total_paid"          : totals["total_paid"],
        "total_due"           : totals["total_billed"],
        "outstanding_balance" : totals["outstanding"],
        "credit_balance"      : totals["credit"],
        "ledger_summary"      : f"Billed: ₹{totals['total_billed']:,.0f} | Paid: ₹{totals['total_paid']:,.0f} | Remaining: ₹{totals['outstanding']:,.0f}",
        "total_pending"       : totals["outstanding"],
        "payments": [
            {
                "payment_id"        : p.payment_id,
                "month_year"        : p.month_year,
                "due_amount"        : p.due_amount,
                "electricity_amount": p.electricity_amount,
                "additional_amount" : p.additional_amount,
                "total_due"         : snapshots[p.payment_id]["current_charges"],
                "arrears"           : snapshots[p.payment_id]["opening_balance"],
                "opening_credit"    : snapshots[p.payment_id]["opening_credit"],
                "payable"           : snapshots[p.payment_id]["payable"],
                "amount_paid"       : p.amount_paid,
                "balance"           : snapshots[p.payment_id]["balance"],
                "credit"            : snapshots[p.payment_id]["credit"],
                "payment_status"    : snapshots[p.payment_id]["status"],
                "transaction_id"    : p.transaction_id,
                "payment_date"      : p.payment_date,
                "is_advance"        : p.is_advance
            }
            for p in payments
        ],
        "transactions": [
            {
                "txn_id"        : tx.txn_id,
                "amount"        : tx.amount,
                "month_year"    : tx.month_year,
                "transaction_id": tx.transaction_id,
                "note"          : tx.note,
                "status"        : tx.status,
                "source"        : tx.source,
                "paid_at"       : tx.paid_at
            }
            for tx in transactions
        ]
    }
