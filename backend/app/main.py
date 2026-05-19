"""
Smart-Stay PG/Hostel Management System
FastAPI Backend - Main Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.database import engine, Base
from app.routers import hostels, rooms, tenants, payments, dashboard, reports, notices
from app.routers.electricity import router as electricity_router

Base.metadata.create_all(bind=engine)

if not os.path.exists("uploads"):
    os.makedirs("uploads")

app = FastAPI(
    title="Smart-Stay API",
    description="Multi-tenant PG/Hostel Management System",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(hostels.router,      prefix="/auth",             tags=["Auth"])
app.include_router(dashboard.router,    prefix="/api/dashboard",    tags=["Dashboard"])
app.include_router(rooms.router,        prefix="/api/rooms",        tags=["Rooms"])
app.include_router(tenants.router,      prefix="/api/tenants",      tags=["Tenants"])
app.include_router(payments.router,     prefix="/api/payments",     tags=["Payments"])
app.include_router(reports.router,      prefix="/api/reports",      tags=["Reports"])
app.include_router(notices.router,      prefix="/api/notices",      tags=["Notices"])
app.include_router(electricity_router,  prefix="/api/charges",      tags=["Charges"])

@app.get("/")
def root():
    return {"message": "Smart-Stay API v2.0 is running! 🏠"}
