"""
database.py - SQLite connection with WAL Mode and Timeout fixes + Temporary Reset Patch
"""

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# ✅ SQLite Database URL
DATABASE_URL = "sqlite:///./sql_app.db"

# ✅ Added 'timeout': 30 to wait for locks to release
engine = create_engine(
    DATABASE_URL, 
    connect_args={
        "check_same_thread": False,
        "timeout": 30
    }
)

# 🔥 PERMANENT FIX: Enable WAL Mode for SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ─────────────────────────────────────────
# 🔥 TEMPORARY RESET ACTION: Wipe out all tables on restart
# ─────────────────────────────────────────
try:
    print("📢 Wiping all local/cloud dummy database metrics schemas...")
    Base.metadata.drop_all(bind=engine)  # 👈 Suthama tables elements-ah erase pannidum da!
    print("✅ Clear database done! Re-initializing blank fresh template frames...")
except Exception as e:
    print(f"❌ Drop tracking skipped or errored: {e}")

# Dependency - use this in all routers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
