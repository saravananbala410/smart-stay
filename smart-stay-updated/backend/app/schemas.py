"""
schemas.py - Pydantic models for request validation & response shaping
"""

from pydantic import BaseModel, ConfigDict, EmailStr, Field
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
    name: str = Field(min_length=2, max_length=200)
    owner_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

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
    new_password: str = Field(min_length=8, max_length=128)

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

    model_config = ConfigDict(from_attributes=True)

# ─── RENT CONFIG ───────────────────────────────────────
class RentConfigUpdate(BaseModel):
    rent_amount: float
    effective_date: date

class RentConfigResponse(BaseModel):
    config_id: int
    sharing_type: str
    rent_amount: float
    effective_date: date

    model_config = ConfigDict(from_attributes=True)

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

    model_config = ConfigDict(from_attributes=True)

# ─── PAYMENTS ──────────────────────────────────────────
class PaymentCreate(BaseModel):
    tenant_id: int
    amount_paid: float = Field(gt=0, le=10000000)
    month_year: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    transaction_id: Optional[str] = None
    is_advance: bool = False
    note: Optional[str] = None


class PaymentRequestCreate(BaseModel):
    tenant_id: int
    month_year: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    amount: Optional[float] = Field(default=None, gt=0, le=10000000)


class PaymentRequestSubmit(BaseModel):
    payer_reference: str = Field(min_length=4, max_length=100)


class PaymentRequestReview(BaseModel):
    status: str
    failure_reason: Optional[str] = Field(default=None, max_length=255)

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

    model_config = ConfigDict(from_attributes=True)

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

    model_config = ConfigDict(from_attributes=True)

# ─── FEEDBACK ───────────────────────────────────────────
class FeedbackCreate(BaseModel):
    name: str
    message: str

class FeedbackResponse(BaseModel):
    feedback_id: int
    name: str
    message: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ─── PAYMENT TRANSACTION ───────────────────────────────
class PaymentTransactionResponse(BaseModel):
    txn_id: int
    tenant_id: int
    amount: float
    month_year: str
    transaction_id: Optional[str]
    note: Optional[str]
    paid_at: datetime

    model_config = ConfigDict(from_attributes=True)
