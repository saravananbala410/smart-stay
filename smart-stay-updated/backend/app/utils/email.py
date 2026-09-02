"""Password-recovery delivery through an HTTPS provider or SMTP fallback."""

import logging
import os
import smtplib
from email.message import EmailMessage

import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
EMAIL_FROM = os.getenv("EMAIL_FROM", "Smart Stay <onboarding@resend.dev>").strip()
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def _resend_is_configured() -> bool:
    invalid_values = {"", "your_resend_api_key", "re_your_api_key"}
    return RESEND_API_KEY.lower() not in invalid_values and bool(EMAIL_FROM)


def _smtp_is_configured() -> bool:
    invalid_values = {"", "your@gmail.com", "your_app_password", "your_gmail_app_password"}
    return (
        bool(SMTP_HOST)
        and SMTP_EMAIL.lower() not in invalid_values
        and SMTP_PASSWORD.lower() not in invalid_values
    )


def email_is_configured() -> bool:
    """Return True when either HTTPS email delivery or SMTP is configured."""
    return _resend_is_configured() or _smtp_is_configured()


def _email_content(reset_link: str) -> tuple[str, str]:
    text_body = (
        "Reset your Smart Stay password using this secure link:\n\n"
        f"{reset_link}\n\nThis link expires in 1 hour."
    )
    html_body = f"""
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
    """
    return text_body, html_body


def _send_with_resend(to_email: str, text_body: str, html_body: str) -> bool:
    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": EMAIL_FROM,
                "to": [to_email],
                "subject": "Smart Stay - Password reset",
                "text": text_body,
                "html": html_body,
            },
            timeout=10,
        )
        if response.ok:
            logger.info("Password reset email accepted by HTTPS provider")
            return True
        logger.error(
            "HTTPS email provider rejected password reset: status=%s response=%s",
            response.status_code,
            response.text[:300],
        )
    except requests.RequestException:
        logger.exception("HTTPS email provider request failed")
    return False


def _send_with_smtp(to_email: str, text_body: str, html_body: str) -> bool:
    message = EmailMessage()
    message["Subject"] = "Smart Stay - Password reset"
    message["From"] = SMTP_EMAIL
    message["To"] = to_email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(message)
        logger.info("Password reset email accepted by SMTP provider")
        return True
    except (OSError, smtplib.SMTPException):
        logger.exception("Password reset SMTP delivery failed")
        return False


def send_reset_email(to_email: str, reset_token: str) -> bool:
    """Send a reset email and report whether the configured provider accepted it."""
    if not email_is_configured():
        logger.error("Password reset email skipped: no email provider is configured")
        return False

    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    text_body, html_body = _email_content(reset_link)
    if _resend_is_configured():
        return _send_with_resend(to_email, text_body, html_body)
    return _send_with_smtp(to_email, text_body, html_body)
