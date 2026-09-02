import unittest
from unittest.mock import patch

from app.utils import email


class EmailConfigurationTests(unittest.TestCase):
    def test_placeholder_credentials_are_not_treated_as_configured(self):
        with patch.object(email, "SMTP_EMAIL", "your@gmail.com"), patch.object(
            email, "SMTP_PASSWORD", "your_app_password"
        ):
            self.assertFalse(email.email_is_configured())

    def test_real_looking_credentials_are_treated_as_configured(self):
        with patch.object(email, "SMTP_EMAIL", "admin@example.com"), patch.object(
            email, "SMTP_PASSWORD", "sixteencharvalue"
        ):
            self.assertTrue(email.email_is_configured())

    def test_delivery_failure_is_reported(self):
        with patch.object(email, "SMTP_EMAIL", "admin@example.com"), patch.object(
            email, "SMTP_PASSWORD", "sixteencharvalue"
        ), patch.object(email.smtplib, "SMTP_SSL", side_effect=OSError("offline")), patch.object(
            email.logger, "exception"
        ):
            self.assertFalse(email.send_reset_email("tenant@example.com", "token"))


if __name__ == "__main__":
    unittest.main()
