"""
schemas.py - Pydantic models for request validation & response shaping
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime
from enum import Enum

class SharingType(str, Enum):
    two   = "2"
    three = "3"
    four  = "4"
    six   = "6"

class TenantStatus(str, Enum):
    active  = "Active"
    vacated = "Vacated"

# ─── AUTH ──────────────────────────────────────────────
class HostelRegister(BaseModel):
    name: str
    owner_name: str
    email: EmailStr
    password: str

class HostelLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    hostel_id: int
    hostel_name: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# ─── ROOMS ─────────────────────────────────────────────
class RoomCreate(BaseModel):
    room_number: str
    sharing_type: SharingType
    base_rent: float
    total_beds: int

class RoomResponse(BaseModel):
    room_id: int
    room_number: str
    sharing_type: str
    base_rent: float
    total_beds: int
    occupied_beds: int
    vacant_beds: int = 0

    class Config:
        from_attributes = True

# ─── RENT CONFIG ───────────────────────────────────────
class RentConfigUpdate(BaseModel):
    rent_amount: float
    effective_date: date

class RentConfigResponse(BaseModel):
    config_id: int
    sharing_type: str
    rent_amount: float
    effective_date: date

    class Config:
        from_attributes = True

# ─── TENANTS ───────────────────────────────────────────
class TenantCreate(BaseModel):
    room_id: int
    name: str
    phone: str
    aadhaar_number: str
    emergency_contact: Optional[str] = None
    joining_date: date

class TenantUpdate(BaseModel):
    status: Optional[TenantStatus] = None
    room_id: Optional[int] = None
    phone: Optional[str] = None

class TenantResponse(BaseModel):
    tenant_id: int
    name: str
    phone: str
    aadhaar_number: str
    emergency_contact: Optional[str]
    photo_url: Optional[str]
    aadhaar_pdf_url: Optional[str]
    joining_date: date
    status: str
    room_id: Optional[int]

    class Config:
        from_attributes = True

# ─── PAYMENTS ──────────────────────────────────────────
class PaymentCreate(BaseModel):
    tenant_id: int
    amount_paid: float
    month_year: str          # "2025-01"
    transaction_id: Optional[str] = None
    is_advance: bool = False
    note: Optional[str] = None

class PaymentResponse(BaseModel):
    payment_id: int
    tenant_id: int
    amount_paid: float
    due_amount: float
    arrears: float
    month_year: str
    transaction_id: Optional[str]
    is_advance: bool
    payment_date: Optional[datetime]

    class Config:
        from_attributes = True

# ─── DASHBOARD ─────────────────────────────────────────
class DashboardStats(BaseModel):
    total_tenants: int
    vacant_beds: int
    total_collection_this_month: float
    total_pending_rent: float
    total_rooms: int

# ─── NOTICES ───────────────────────────────────────────
class NoticeCreate(BaseModel):
    title: str
    content: str

class NoticeResponse(BaseModel):
    notice_id: int
    title: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

# ─── PAYMENT TRANSACTION ───────────────────────────────
class PaymentTransactionResponse(BaseModel):
    txn_id: int
    tenant_id: int
    amount: float
    month_year: str
    transaction_id: Optional[str]
    note: Optional[str]
    paid_at: datetime

    class Config:
        from_attributes = True
