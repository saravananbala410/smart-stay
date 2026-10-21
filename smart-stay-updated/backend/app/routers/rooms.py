"""
routers/rooms.py - Room CRUD + Dynamic Rent Configuration
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from app.database import get_db
from app import models, schemas
from app.auth import get_current_hostel

router = APIRouter()

# ─────────────────────────────────────────
# GET /api/rooms - List all rooms
# ─────────────────────────────────────────
@router.get("/", response_model=List[schemas.RoomResponse])
def list_rooms(
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    rooms = db.query(models.Room).filter(
        models.Room.hostel_id == current_hostel.hostel_id
    ).all()

    result = []
    for r in rooms:
        result.append({
            **r.__dict__,
            "vacant_beds": r.total_beds - r.occupied_beds
        })
    return result

# ─────────────────────────────────────────
# POST /api/rooms - Create room
# ─────────────────────────────────────────
@router.post("/", response_model=schemas.RoomResponse, status_code=201)
def create_room(
    payload: schemas.RoomCreate,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    room = models.Room(
        hostel_id    = current_hostel.hostel_id,
        room_number  = payload.room_number,
        sharing_type = payload.sharing_type,
        base_rent    = payload.base_rent,
        total_beds   = payload.total_beds,
        occupied_beds= 0
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return {**room.__dict__, "vacant_beds": room.total_beds}

# ─────────────────────────────────────────
# DELETE /api/rooms/{room_id}
# ─────────────────────────────────────────
@router.delete("/{room_id}")
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    room = db.query(models.Room).filter(
        models.Room.room_id   == room_id,
        models.Room.hostel_id == current_hostel.hostel_id
    ).first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.occupied_beds > 0:
        raise HTTPException(status_code=400, detail="Cannot delete room with active tenants")

    db.delete(room)
    db.commit()
    return {"message": "Room deleted"}

# ─────────────────────────────────────────
# PATCH /api/rooms/rent-configuration/{sharing_type}
# ✅ CORE: Update rent for all rooms of this sharing type
# ─────────────────────────────────────────
@router.patch("/rent-configuration/{sharing_type}")
def update_rent_config(
    sharing_type: str,
    payload: schemas.RentConfigUpdate,
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    hid = current_hostel.hostel_id

    if sharing_type not in {s.value for s in models.SharingType}:
        raise HTTPException(status_code=422, detail="Sharing type must be 2, 3, 4 or 6")
    if payload.rent_amount <= 0:
        raise HTTPException(status_code=422, detail="Rent must be greater than zero")

    # Keep rent history: one row per effective date, so old months keep old rent.
    config = db.query(models.RentConfiguration).filter(
        models.RentConfiguration.hostel_id    == hid,
        models.RentConfiguration.sharing_type == sharing_type,
        models.RentConfiguration.effective_date == payload.effective_date
    ).first()

    if config:
        config.rent_amount   = payload.rent_amount
    else:
        # Room base_rent is left untouched: it stays the rent for months
        # before the first effective date.
        config = models.RentConfiguration(
            hostel_id    = hid,
            sharing_type = sharing_type,
            rent_amount  = payload.rent_amount,
            effective_date= payload.effective_date
        )
        db.add(config)

    db.commit()
    return {
        "message"     : f"Rent updated for all {sharing_type}-sharing rooms",
        "new_rent"    : payload.rent_amount,
        "effective_from": str(payload.effective_date)
    }

# ─────────────────────────────────────────
# GET /api/rooms/rent-configuration - Get all configs
# ─────────────────────────────────────────
@router.get("/rent-configuration", response_model=List[schemas.RentConfigResponse])
def get_rent_configs(
    db: Session = Depends(get_db),
    current_hostel: models.Hostel = Depends(get_current_hostel)
):
    return db.query(models.RentConfiguration).filter(
        models.RentConfiguration.hostel_id == current_hostel.hostel_id
    ).all()
