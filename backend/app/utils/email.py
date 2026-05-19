"""
utils/email.py - Email sending for forgot password
Uses Gmail SMTP (free)
"""

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_EMAIL    = os.getenv("SMTP_EMAIL", "your@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "your_app_password")
FRONTEND_URL  = os.getenv("FRONTEND_URL", "http://localhost:5173")

def send_reset_email(to_email: str, reset_token: str):
    """Send password reset email"""
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Smart-Stay - Password Reset Request"
    msg["From"]    = SMTP_EMAIL
    msg["To"]      = to_email

    html = f"""
    <html><body>
    <h2>🏠 Smart-Stay Password Reset</h2>
    <p>Click the link below to reset your password:</p>
    <a href="{reset_link}" style="background:#6366f1;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">
        Reset Password
    </a>
    <p>This link expires in 1 hour.</p>
    <p>If you didn't request this, ignore this email.</p>
    </body></html>
    """
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        print(f"✅ Reset email sent to {to_email}")
    except Exception as e:
        print(f"❌ Email send failed: {e}")
        # Don't raise — email failure shouldn't break the API
