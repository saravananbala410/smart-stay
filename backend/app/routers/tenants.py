"""
routers/tenants.py - Tenant CRUD with Photo + Aadhaar PDF upload
FIXES:
- Active / Vacated separate listing
- vacated_date recorded when marking vacated
- Photo stored locally (not just Cloudinary URL hack)
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
import os, uuid

from app.database import get_db
from app import models, schemas
from app.auth import get_current_hostel
from app.utils.file_upload import upload_to_cloudinary

router = APIRouter()

UPLOAD_DIR = "uploads"

def save_file_locally(file_bytes: bytes, filename: str, subfolder: str) -> str:
    folder = os.path.join(UPLOAD_DIR, subfolder)
    os.makedirs(folder, exist_ok=True)
    ext  = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    name = f"{uuid.uuid4()}.{ext}"
    path = os.path.join(folder, name)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return f"{subfolder}/{name}"   # relative path stored in DB


@router.post("/", status_code=201)
async def create_tenant(
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

    room = db.query(models.Room).filter(
        models.Room.room_id   == room_id,
        models.Room.hostel_id == hid
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.occupied_beds >= room.total_beds:
        raise HTTPException(status_code=400, detail="Room is full. No vacant beds.")

    photo_url       = None
    aadhaar_pdf_url = None

    if photo:
        try:
            photo_url = await upload_to_cloudinary(photo, folder="photos")
            # If cloudinary returns a placeholder, fall back to local
            if "placeholder.com" in (photo_url or ""):
                photo.file.seek(0)
                photo_bytes = await photo.read()
                photo_url = save_file_locally(photo_bytes, photo.filename, "photos")
        except Exception:
            photo_bytes = await photo.read()
            photo_url = save_file_locally(photo_bytes, photo.filename, "photos")

    if aadhaar_pdf:
        try:
            aadhaar_pdf_url = await upload_to_cloudinary(aadhaar_pdf, folder="aadhaar")
            if "placeholder.com" in (aadhaar_pdf_url or ""):
                aadhaar_pdf.file.seek(0)
                pdf_bytes = await aadhaar_pdf.read()
                aadhaar_pdf_url = save_file_locally(pdf_bytes, aadhaar_pdf.filename, "aadhaar")
        except Exception:
            pdf_bytes = await aadhaar_pdf.read()
            aadhaar_pdf_url = save_file_locally(pdf_bytes, aadhaar_pdf.filename, "aadhaar")

    tenant = models.Tenant(
        hostel_id        = hid,
        room_id          = room_id,
        name             = name,
        phone            = phone,
        aadhaar_number   = aadhaar_number,
        emergency_contact= emergency_contact,
        photo_url        = photo_url,
        aadhaar_pdf_url  = aadhaar_pdf_url,
        joining_date     = joining_date,
        status           = "Active"
    )
    db.add(tenant)
    room.occupied_beds += 1
    db.commit()
    db.refresh(tenant)
    return {"message": "Tenant added successfully", "tenant_id": tenant.tenant_id}


@router.get("/")
def list_tenants(
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    query = db.query(models.Tenant).filter(
        models.Tenant.hostel_id == current_hostel.hostel_id
    )
    if search:
        query = query.filter(
            models.Tenant.name.ilike(f"%{search}%") |
            models.Tenant.phone.ilike(f"%{search}%")
        )
    if status:
        query = query.filter(models.Tenant.status == status)

    tenants = query.all()
    result = []
    for t in tenants:
        room_info = None
        if t.room:
            room_info = {
                "room_number" : t.room.room_number,
                "sharing_type": t.room.sharing_type
            }
        result.append({
            "tenant_id"    : t.tenant_id,
            "name"         : t.name,
            "phone"        : t.phone,
            "status"       : t.status,
            "joining_date" : t.joining_date,
            "vacated_date" : t.vacated_date,
            "photo_url"    : t.photo_url,
            "room"         : room_info
        })
    return result


@router.get("/{tenant_id}")
def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    tenant = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == tenant_id,
        models.Tenant.hostel_id == current_hostel.hostel_id
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    room_info = None
    if tenant.room:
        room_info = {
            "room_id"     : tenant.room.room_id,
            "room_number" : tenant.room.room_number,
            "sharing_type": tenant.room.sharing_type,
            "base_rent"   : tenant.room.base_rent
        }

    return {
        "tenant_id"        : tenant.tenant_id,
        "name"             : tenant.name,
        "phone"            : tenant.phone,
        "aadhaar_number"   : tenant.aadhaar_number,
        "emergency_contact": tenant.emergency_contact,
        "photo_url"        : tenant.photo_url,
        "aadhaar_pdf_url"  : tenant.aadhaar_pdf_url,
        "joining_date"     : tenant.joining_date,
        "vacated_date"     : tenant.vacated_date,
        "status"           : tenant.status,
        "room"             : room_info
    }


@router.patch("/{tenant_id}")
def update_tenant(
    tenant_id: int,
    payload: schemas.TenantUpdate,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    tenant = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == tenant_id,
        models.Tenant.hostel_id == current_hostel.hostel_id
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if payload.status == "Vacated" and tenant.status == "Active":
        if tenant.room:
            tenant.room.occupied_beds = max(0, tenant.room.occupied_beds - 1)
        tenant.vacated_date = date.today()

    if payload.status:
        tenant.status = payload.status
    if payload.phone:
        tenant.phone = payload.phone

    db.commit()
    return {"message": "Tenant updated successfully"}


@router.get("/{tenant_id}/payments")
def get_tenant_payments(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    tenant = db.query(models.Tenant).filter(
        models.Tenant.tenant_id == tenant_id,
        models.Tenant.hostel_id == current_hostel.hostel_id
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    payments = db.query(models.Payment).filter(
        models.Payment.tenant_id == tenant_id
    ).order_by(models.Payment.month_year.desc()).all()

    total_paid    = sum(p.amount_paid for p in payments)
    total_due     = sum(p.due_amount + p.electricity_amount + p.additional_amount for p in payments)
    total_pending = sum(
        max(0, (p.due_amount + p.electricity_amount + p.additional_amount) - p.amount_paid + p.arrears)
        for p in payments
    )

    return {
        "tenant_name"   : tenant.name,
        "joining_date"  : tenant.joining_date,
        "total_paid"    : round(total_paid, 2),
        "total_due"     : round(total_due, 2),
        "total_pending" : round(total_pending, 2),
        "payments": [
            {
                "payment_id"        : p.payment_id,
                "month_year"        : p.month_year,
                "due_amount"        : p.due_amount,
                "electricity_amount": p.electricity_amount,
                "additional_amount" : p.additional_amount,
                "total_due"         : p.due_amount + p.electricity_amount + p.additional_amount,
                "arrears"           : p.arrears,
                "amount_paid"       : p.amount_paid,
                "balance"           : round(max(0, (p.due_amount + p.electricity_amount + p.additional_amount) - p.amount_paid + p.arrears), 2),
                "transaction_id"    : p.transaction_id,
                "payment_date"      : p.payment_date,
                "is_advance"        : p.is_advance
            }
            for p in payments
        ]
    }
