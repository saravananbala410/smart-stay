"""Password-recovery email delivery with explicit configuration checks."""

import logging
import os
import smtplib
from email.message import EmailMessage

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def email_is_configured() -> bool:
    """Return True only when real SMTP credentials are present."""
    invalid_values = {"", "your@gmail.com", "your_app_password", "your_gmail_app_password"}
    return (
        bool(SMTP_HOST)
        and SMTP_EMAIL.lower() not in invalid_values
        and SMTP_PASSWORD.lower() not in invalid_values
    )


def send_reset_email(to_email: str, reset_token: str) -> bool:
    """Send a reset email and report whether the provider accepted it."""
    if not email_is_configured():
        logger.error("Password reset email skipped: SMTP is not configured")
        return False

    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    message = EmailMessage()
    message["Subject"] = "Smart Stay - Password reset"
    message["From"] = SMTP_EMAIL
    message["To"] = to_email
    message.set_content(
        "Reset your Smart Stay password using this secure link:\n\n"
        f"{reset_link}\n\nThis link expires in 1 hour."
    )
    message.add_alternative(
        f"""
        <html><body style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
          <div style="max-width:520px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:18px">
            <p style="font-size:12px;font-weight:700;letter-spacing:.12em;color:#6366f1;text-transform:uppercase">Smart Stay</p>
            <h2 style="margin:8px 0 10px">Reset your password</h2>
            <p style="color:#667085">Use the button below to choose a new password for your property workspace.</p>
            <p style="margin:26px 0">
              <a href="{reset_link}" style="background:#4f46e5;color:white;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Reset password</a>
            </p>
            <p style="font-size:12px;color:#98a2b3">This link expires in 1 hour. If you did not request it, you can ignore this email.</p>
          </div>
        </body></html>
        """,
        subtype="html",
    )

    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(message)
        logger.info("Password reset email accepted by SMTP provider")
        return True
    except (OSError, smtplib.SMTPException):
        logger.exception("Password reset email delivery failed")
        return False
