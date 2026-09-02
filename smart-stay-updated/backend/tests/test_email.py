import unittest
from unittest.mock import patch

from app.utils import email


class EmailConfigurationTests(unittest.TestCase):
    def test_placeholder_credentials_are_not_treated_as_configured(self):
        with patch.object(email, "RESEND_API_KEY", "your_resend_api_key"), patch.object(
            email, "SMTP_EMAIL", "your@gmail.com"
        ), patch.object(
            email, "SMTP_PASSWORD", "your_app_password"
        ):
            self.assertFalse(email.email_is_configured())

    def test_real_looking_credentials_are_treated_as_configured(self):
        with patch.object(email, "RESEND_API_KEY", ""), patch.object(
            email, "SMTP_EMAIL", "admin@example.com"
        ), patch.object(
            email, "SMTP_PASSWORD", "sixteencharvalue"
        ):
            self.assertTrue(email.email_is_configured())

    def test_resend_credentials_are_treated_as_configured(self):
        with patch.object(email, "RESEND_API_KEY", "re_valid_key"), patch.object(
            email, "SMTP_EMAIL", ""
        ), patch.object(email, "SMTP_PASSWORD", ""):
            self.assertTrue(email.email_is_configured())

    def test_resend_success_is_reported(self):
        response = unittest.mock.Mock(ok=True)
        with patch.object(email, "RESEND_API_KEY", "re_valid_key"), patch.object(
            email.requests, "post", return_value=response
        ) as post:
            self.assertTrue(email.send_reset_email("tenant@example.com", "token"))
            self.assertEqual(post.call_args.kwargs["timeout"], 10)

    def test_delivery_failure_is_reported(self):
        with patch.object(email, "RESEND_API_KEY", ""), patch.object(
            email, "SMTP_EMAIL", "admin@example.com"
        ), patch.object(
            email, "SMTP_PASSWORD", "sixteencharvalue"
        ), patch.object(email.smtplib, "SMTP_SSL", side_effect=OSError("offline")), patch.object(
            email.logger, "exception"
        ):
            self.assertFalse(email.send_reset_email("tenant@example.com", "token"))


if __name__ == "__main__":
    unittest.main()
