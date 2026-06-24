"""
models.py - All Database Tables (SQLAlchemy ORM)
Multi-tenant: Every table has hostel_id for data isolation
v3.0 - Added PaymentTransaction for individual transaction logs
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class SharingType(str, enum.Enum):
    two   = "2"
    three = "3"
    four  = "4"
    six   = "6"

class TenantStatus(str, enum.Enum):
    active  = "Active"
    vacated = "Vacated"

class Hostel(Base):
    __tablename__ = "hostels"
    hostel_id         = Column(Integer, primary_key=True, index=True)
    name              = Column(String(200), nullable=False)
    owner_name        = Column(String(100), nullable=False)
    email             = Column(String(150), unique=True, nullable=False, index=True)
    password_hash     = Column(String(255), nullable=False)
    subscription_plan = Column(String(50), default="free")
    address           = Column(String(500), nullable=True)
    image_url         = Column(String(500), nullable=True)
    reset_token       = Column(String(255), nullable=True)
    reset_token_expiry= Column(DateTime, nullable=True)
    created_at        = Column(DateTime, server_default=func.now())
    rooms             = relationship("Room", back_populates="hostel", cascade="all, delete")
    tenants           = relationship("Tenant", back_populates="hostel", cascade="all, delete")
    payments          = relationship("Payment", back_populates="hostel", cascade="all, delete")
    transactions      = relationship("PaymentTransaction", back_populates="hostel", cascade="all, delete")
    rent_configs      = relationship("RentConfiguration", back_populates="hostel", cascade="all, delete")
    notices           = relationship("Notice", back_populates="hostel", cascade="all, delete")
    feedbacks         = relationship("Feedback", back_populates="hostel", cascade="all, delete")
    electricity_bills = relationship("ElectricityBill", back_populates="hostel", cascade="all, delete")
    additional_charges= relationship("AdditionalCharge", back_populates="hostel", cascade="all, delete")

class Room(Base):
    __tablename__ = "rooms"
    room_id      = Column(Integer, primary_key=True, index=True)
    hostel_id    = Column(Integer, ForeignKey("hostels.hostel_id"), nullable=False)
    room_number  = Column(String(20), nullable=False)
    sharing_type = Column(Enum(SharingType), nullable=False)
    base_rent    = Column(Float, nullable=False)
    total_beds   = Column(Integer, nullable=False)
    occupied_beds= Column(Integer, default=0)
    hostel  = relationship("Hostel", back_populates="rooms")
    tenants = relationship("Tenant", back_populates="room")

class Tenant(Base):
    __tablename__ = "tenants"
    tenant_id         = Column(Integer, primary_key=True, index=True)
    hostel_id         = Column(Integer, ForeignKey("hostels.hostel_id"), nullable=False)
    room_id           = Column(Integer, ForeignKey("rooms.room_id"), nullable=True)
    name              = Column(String(100), nullable=False)
    phone             = Column(String(15), nullable=False)
    aadhaar_number    = Column(String(12), nullable=False)
    emergency_contact = Column(String(15), nullable=True)
    photo_url         = Column(String(500), nullable=True)
    aadhaar_pdf_url   = Column(String(500), nullable=True)
    joining_date      = Column(Date, nullable=False)
    vacated_date      = Column(Date, nullable=True)
    status            = Column(Enum(TenantStatus), default=TenantStatus.active)
    created_at        = Column(DateTime, server_default=func.now())
    hostel       = relationship("Hostel", back_populates="tenants")
    room         = relationship("Room", back_populates="tenants")
    payments     = relationship("Payment", back_populates="tenant", cascade="all, delete")
    transactions = relationship("PaymentTransaction", back_populates="tenant", cascade="all, delete")

class RentConfiguration(Base):
    __tablename__ = "rent_configurations"
    config_id    = Column(Integer, primary_key=True, index=True)
    hostel_id    = Column(Integer, ForeignKey("hostels.hostel_id"), nullable=False)
    sharing_type = Column(Enum(SharingType), nullable=False)
    rent_amount  = Column(Float, nullable=False)
    effective_date = Column(Date, nullable=False)
    created_at   = Column(DateTime, server_default=func.now())
    hostel = relationship("Hostel", back_populates="rent_configs")

class Payment(Base):
    """Monthly payment ledger record — one row per tenant per month"""
    __tablename__ = "payments"
    payment_id          = Column(Integer, primary_key=True, index=True)
    tenant_id           = Column(Integer, ForeignKey("tenants.tenant_id"), nullable=False)
    hostel_id           = Column(Integer, ForeignKey("hostels.hostel_id"), nullable=False)
    amount_paid         = Column(Float, default=0)
    due_amount          = Column(Float, default=0)
    electricity_amount  = Column(Float, default=0)
    additional_amount   = Column(Float, default=0)
    arrears             = Column(Float, default=0)
    payment_date        = Column(DateTime, nullable=True)
    month_year          = Column(String(7), nullable=False)
    transaction_id      = Column(String(100), nullable=True)
    is_advance          = Column(Boolean, default=False)
    created_at          = Column(DateTime, server_default=func.now())
    tenant = relationship("Tenant", back_populates="payments")
    hostel = relationship("Hostel", back_populates="payments")

class PaymentTransaction(Base):
    """Individual payment transaction log — every cash entry is a separate row (FIX #3)"""
    __tablename__ = "payment_transactions"
    txn_id       = Column(Integer, primary_key=True, index=True)
    tenant_id    = Column(Integer, ForeignKey("tenants.tenant_id"), nullable=False)
    hostel_id    = Column(Integer, ForeignKey("hostels.hostel_id"), nullable=False)
    payment_id   = Column(Integer, ForeignKey("payments.payment_id"), nullable=True)
    amount       = Column(Float, nullable=False)
    month_year   = Column(String(7), nullable=False)
    transaction_id = Column(String(100), nullable=True)
    note         = Column(String(255), nullable=True)
    paid_at      = Column(DateTime, server_default=func.now())
    tenant = relationship("Tenant", back_populates="transactions")
    hostel = relationship("Hostel", back_populates="transactions")

class Notice(Base):
    __tablename__ = "notices"
    notice_id  = Column(Integer, primary_key=True, index=True)
    hostel_id  = Column(Integer, ForeignKey("hostels.hostel_id"), nullable=False)
    title      = Column(String(200), nullable=False)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    hostel = relationship("Hostel", back_populates="notices")

class Feedback(Base):
    __tablename__ = "feedback"
    feedback_id = Column(Integer, primary_key=True, index=True)
    hostel_id   = Column(Integer, ForeignKey("hostels.hostel_id"), nullable=False)
    name        = Column(String(100), nullable=False)
    message     = Column(Text, nullable=False)
    device      = Column(String(255), nullable=True)
    created_at  = Column(DateTime, server_default=func.now())
    hostel = relationship("Hostel", back_populates="feedbacks")

class ElectricityBill(Base):
    __tablename__ = "electricity_bills"
    bill_id       = Column(Integer, primary_key=True, index=True)
    hostel_id     = Column(Integer, ForeignKey("hostels.hostel_id"), nullable=False)
    room_number   = Column(String(20), nullable=False)
    total_amount  = Column(Float, nullable=False)
    month_year    = Column(String(7), nullable=False)
    per_tenant    = Column(Float, nullable=False)
    created_at    = Column(DateTime, server_default=func.now())
    hostel = relationship("Hostel", back_populates="electricity_bills")

class AdditionalCharge(Base):
    __tablename__ = "additional_charges"
    charge_id     = Column(Integer, primary_key=True, index=True)
    hostel_id     = Column(Integer, ForeignKey("hostels.hostel_id"), nullable=False)
    charge_name   = Column(String(100), nullable=False)
    room_number   = Column(String(20), nullable=True)   # NULL = hostel-wide split
    total_amount  = Column(Float, nullable=False)
    month_year    = Column(String(7), nullable=False)
    per_tenant    = Column(Float, nullable=False)
    created_at    = Column(DateTime, server_default=func.now())
    hostel = relationship("Hostel", back_populates="additional_charges")
