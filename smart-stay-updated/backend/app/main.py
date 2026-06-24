"""
Smart-Stay PG/Hostel Management System
FastAPI Backend - Main Entry Point
v3.0 — All 9 fixes + bonus features applied
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.database import engine, Base
from app.routers import hostels, rooms, tenants, payments, dashboard, reports, notices, feedback
from app.routers.electricity import router as electricity_router
from app.routers.invoices    import router as invoices_router

Base.metadata.create_all(bind=engine)

for d in ["uploads", "uploads/photos", "uploads/aadhaar"]:
    os.makedirs(d, exist_ok=True)

app = FastAPI(
    title="Smart-Stay API",
    description="Multi-tenant PG/Hostel Management System v3.0",
    version="3.0.0"
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
app.include_router(feedback.router,     prefix="/api/feedback",     tags=["Feedback"])
app.include_router(electricity_router,  prefix="/api/charges",      tags=["Charges"])
app.include_router(invoices_router,     prefix="/api/invoice",      tags=["Invoice"])

@app.get("/")
def root():
    return {"message": "Smart-Stay API v3.0 is running! 🏠", "docs": "/docs"}
