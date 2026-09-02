"""
database.py - SQLite connection with WAL mode and lock timeout settings.
"""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

env_database_url = os.getenv("DATABASE_URL", "").strip()
# Some managed providers still expose the legacy postgres:// scheme. SQLAlchemy
# expects postgresql:// when loading the PostgreSQL driver.
if env_database_url.startswith("postgres://"):
    env_database_url = "postgresql://" + env_database_url[len("postgres://"):]

DATABASE_URL = (
    env_database_url
    if env_database_url and "yourpassword" not in env_database_url
    else "sqlite:///./sql_app.db"
)

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False,
        "timeout": 30,
    } if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True,
    pool_recycle=1800,
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if not DATABASE_URL.startswith("sqlite"):
        return

    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

if os.getenv("RESET_DB_ON_STARTUP") == "1":
    try:
        print("[database] RESET_DB_ON_STARTUP=1, dropping all tables...")
        Base.metadata.drop_all(bind=engine)
        print("[database] Database reset complete.")
    except Exception as exc:
        print(f"[database] Database reset skipped or failed: {exc}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
