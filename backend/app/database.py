"""
database.py - SQLite connection with WAL Mode and Timeout fixes
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
# Idhu dhaan 'Database is locked' error-ah solve pannum
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ✅ Dependency - use this in all routers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 