"""
routers/hostels.py - Auth endpoints: Register, Login, Forgot/Reset Password
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from datetime import datetime, timedelta
import secrets

from app.database import get_db
from app import models, schemas
from app.auth import hash_password, verify_password, create_access_token, get_current_hostel
from app.utils.email import email_is_configured, send_reset_email

router = APIRouter()

# ─────────────────────────────────────────
# POST /api/auth/register
# ─────────────────────────────────────────
@router.post("/register", response_model=schemas.TokenResponse, status_code=201)
def register(payload: schemas.HostelRegister, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    # Check duplicate email
    existing = db.query(models.Hostel).filter(models.Hostel.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    hostel = models.Hostel(
        name          = payload.name.strip(),
        owner_name    = payload.owner_name.strip(),
        email         = email,
        password_hash = hash_password(payload.password)
    )
    try:
        db.add(hostel)
        db.commit()
        db.refresh(hostel)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered.")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Account database is temporarily unavailable. Please try again.")

    token = create_access_token({"hostel_id": hostel.hostel_id, "email": hostel.email})
    return {
        "access_token": token,
        "hostel_id"   : hostel.hostel_id,
        "hostel_name" : hostel.name
    }

# ─────────────────────────────────────────
# POST /api/auth/login
# ─────────────────────────────────────────
@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.HostelLogin, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    hostel = db.query(models.Hostel).filter(models.Hostel.email == email).first()

    if not hostel or not verify_password(payload.password, hostel.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token({"hostel_id": hostel.hostel_id, "email": hostel.email})
    return {
        "access_token": token,
        "hostel_id"   : hostel.hostel_id,
        "hostel_name" : hostel.name
    }

# ─────────────────────────────────────────
# POST /api/auth/forgot-password
# ─────────────────────────────────────────
@router.post("/forgot-password")
def forgot_password(
    payload: schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    if not email_is_configured():
        raise HTTPException(
            status_code=503,
            detail="Password recovery email is not configured. Please contact the administrator."
        )

    email = str(payload.email).strip().lower()
    hostel = db.query(models.Hostel).filter(models.Hostel.email == email).first()

    # Always return success (don't reveal if email exists)
    if not hostel:
        return {"message": "If this email exists, a reset link has been sent."}

    reset_token = secrets.token_urlsafe(32)
    hostel.reset_token        = reset_token
    hostel.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    if not send_reset_email(hostel.email, reset_token):
        hostel.reset_token = None
        hostel.reset_token_expiry = None
        db.commit()
        raise HTTPException(
            status_code=503,
            detail="The email provider could not send the reset link. Please try again later."
        )
    return {"message": "Password reset link sent to your email."}

# ─────────────────────────────────────────
# POST /api/auth/reset-password
# ─────────────────────────────────────────
@router.post("/reset-password")
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    hostel = db.query(models.Hostel).filter(
        models.Hostel.reset_token == payload.token
    ).first()

    if not hostel:
        raise HTTPException(status_code=400, detail="Invalid reset token.")

    if hostel.reset_token_expiry < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset token has expired.")

    hostel.password_hash     = hash_password(payload.new_password)
    hostel.reset_token       = None
    hostel.reset_token_expiry= None
    db.commit()
    return {"message": "Password reset successful. Please login."}

# ─────────────────────────────────────────
# GET /api/auth/me
# ─────────────────────────────────────────
@router.get("/me")
def get_me(current_hostel: models.Hostel = Depends(get_current_hostel)):
    return {
        "hostel_id"  : current_hostel.hostel_id,
        "name"       : current_hostel.name,
        "owner_name" : current_hostel.owner_name,
        "email"      : current_hostel.email,
        "subscription_plan": current_hostel.subscription_plan,
        "created_at" : current_hostel.created_at
    }
