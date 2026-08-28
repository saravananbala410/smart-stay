"""
Smart-Stay PG/Hostel Management System
FastAPI Backend - Main Entry Point
v3.0 — All 9 fixes + bonus features applied
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
import os
from sqlalchemy import inspect, text
from app.database import engine, Base
from app.routers import hostels, rooms, tenants, payments, dashboard, reports, notices, feedback
from app.routers.electricity import router as electricity_router
from app.routers.invoices    import router as invoices_router

def _ensure_runtime_schema():
    """Small backwards-compatible migration for existing local databases."""
    additions = {
        "hostels": {
            "upi_id": "VARCHAR(150)",
            "payment_due_day": "INTEGER DEFAULT 5",
        },
        "payment_transactions": {
            "status": "VARCHAR(20) NOT NULL DEFAULT 'RECEIVED'",
            "source": "VARCHAR(20) NOT NULL DEFAULT 'MANUAL'",
        },
    }
    with engine.begin() as connection:
        inspector = inspect(connection)
        tables = set(inspector.get_table_names())
        for table, columns in additions.items():
            if table not in tables:
                continue
            present = {column["name"] for column in inspector.get_columns(table)}
            for name, sql_type in columns.items():
                if name not in present:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))


_ensure_runtime_schema()
Base.metadata.create_all(bind=engine)
with engine.begin() as connection:
    connection.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_tenant_month_idx "
        "ON payments (hostel_id, tenant_id, month_year)"
    ))

for d in ["uploads", "uploads/photos", "uploads/aadhaar"]:
    os.makedirs(d, exist_ok=True)

app = FastAPI(
    title="Smart-Stay API",
    description="Multi-tenant PG/Hostel Management System v3.0",
    version="3.0.0"
)

allowed_origins = [item.strip() for item in os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if item.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(hostels.router,      prefix="/auth",             tags=["Auth"])
app.include_router(dashboard.router,    prefix="/api/dashboard",    tags=["Dashboard"])
app.include_router(rooms.router,        prefix="/api/rooms",        tags=["Rooms"])
app.include_router(tenants.router,      prefix="/api/tenants",      tags=["Tenants"])
app.include_router(payments.router,     prefix="/api/payments",     tags=["Payments"])
app.include_router(reports.router,      prefix="/api/reports",      tags=["Reports"])
app.include_router(notices.router,      prefix="/api/notices",      tags=["Notices"])
app.include_router(electricity_router,  prefix="/api/charges",      tags=["Charges"])
app.include_router(invoices_router,     prefix="/api/invoice",      tags=["Invoice"])
app.include_router(feedback.router,     prefix="/api/feedback",     tags=["Feedback"])

@app.get("/")
def root():
    return {"message": "Smart-Stay API v3.0 is running! 🏠", "docs": "/docs"}
