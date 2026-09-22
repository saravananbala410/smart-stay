import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


class PaymentApiFlowTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        from app.main import app
        from app.database import Base, get_db
        self.app = app
        self.engine = create_engine(
            f"sqlite:///{self.temp_db.name}",
            connect_args={"check_same_thread": False},
        )
        Base.metadata.create_all(self.engine)
        testing_session = sessionmaker(bind=self.engine)

        def override_get_db():
            session = testing_session()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        )

    async def asyncTearDown(self):
        await self.client.aclose()
        self.app.dependency_overrides.clear()
        self.engine.dispose()
        try:
            os.unlink(self.temp_db.name)
        except OSError:
            pass

    async def test_qr_submit_verify_and_pdf_receipt_flow(self):
        response = await self.client.post("/auth/register", json={
            "name": "API Test Stay", "owner_name": "Owner",
            "email": "api-flow@example.com", "password": "StrongPassword123!",
        })
        self.assertEqual(response.status_code, 201, response.text)
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = await self.client.post("/auth/login", json={
            "email": "API-FLOW@EXAMPLE.COM", "password": "StrongPassword123!",
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["access_token"])

        with patch("app.routers.hostels.email_is_configured", return_value=False):
            response = await self.client.post("/auth/forgot-password", json={
                "email": "api-flow@example.com",
            })
        self.assertEqual(response.status_code, 503, response.text)
        self.assertIn("not configured", response.json()["detail"].lower())

        response = await self.client.post("/api/rooms/", headers=headers, json={
            "room_number": "A1", "sharing_type": "2", "base_rent": 6000, "total_beds": 2,
        })
        self.assertEqual(response.status_code, 201, response.text)
        room_id = response.json()["room_id"]

        response = await self.client.post("/api/tenants/", headers=headers, data={
            "room_id": str(room_id), "name": "Arun Kumar", "phone": "9876543210",
            "aadhaar_number": "123456789012", "emergency_contact": "9876500000",
            "joining_date": "2026-08-01",
        })
        self.assertEqual(response.status_code, 201, response.text)
        tenant_id = response.json()["tenant_id"]

        response = await self.client.patch(
            "/api/dashboard/hostel-info?upi_id=apitest%40upi&payment_due_day=5",
            headers=headers,
        )
        self.assertEqual(response.status_code, 200, response.text)

        response = await self.client.post(
            "/api/payments/generate-monthly?month_year=2026-08", headers=headers
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["generated"], 1)

        response = await self.client.post("/api/charges/electricity", headers=headers, json={
            "room_number": "A1", "total_amount": 100, "month_year": "2026-08",
        })
        self.assertEqual(response.status_code, 201, response.text)

        response = await self.client.post("/api/payments/payment-requests", headers=headers, json={
            "tenant_id": tenant_id, "month_year": "2026-08",
        })
        self.assertEqual(response.status_code, 201, response.text)
        request = response.json()
        self.assertEqual(request["amount"], 6100.0)
        self.assertTrue(request["upi_configured"])
        self.assertEqual(request["public_url"], f"http://localhost:5173/pay/{request['public_token']}")
        public_token = request["public_token"]
        request_id = request["request_id"]

        qr = await self.client.get(f"/api/payments/payment-request/{public_token}/qr")
        self.assertEqual(qr.status_code, 200, qr.text)
        self.assertEqual(qr.headers["content-type"], "image/png")
        self.assertTrue(qr.content.startswith(b"\x89PNG"))

        response = await self.client.post(
            f"/api/payments/payment-request/{public_token}/submit",
            json={"payer_reference": "UPI123456789012"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "SUBMITTED")

        response = await self.client.patch(
            f"/api/payments/payment-requests/{request_id}/review",
            headers=headers, json={"status": "VERIFIED"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "VERIFIED")
        self.assertIsNotNone(response.json()["receipt_url"])

        ledger = await self.client.get("/api/payments/?month_year=2026-08", headers=headers)
        self.assertEqual(ledger.status_code, 200, ledger.text)
        self.assertEqual(ledger.json()[0]["balance"], 0)
        self.assertEqual(ledger.json()[0]["status"], "PAID")

        receipt = await self.client.get(
            f"/api/invoice/payment-request/{public_token}/download"
        )
        self.assertEqual(receipt.status_code, 200, receipt.text)
        self.assertEqual(receipt.headers["content-type"], "application/pdf")
        self.assertTrue(receipt.content.startswith(b"%PDF"))
        if output_path := os.getenv("RECEIPT_QA_PATH"):
            destination = Path(output_path)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(receipt.content)

    async def test_payment_links_accept_frontend_url_fallback(self):
        from app.routers.payments import _public_origin

        with patch.dict(os.environ, {"FRONTEND_URL": "https://smart-stay.example"}, clear=False):
            with patch.dict(os.environ, {"FRONTEND_PUBLIC_URL": ""}, clear=False):
                self.assertEqual(_public_origin(), "https://smart-stay.example")

    async def test_reset_password_with_missing_expiry_returns_error(self):
        from app import models
        from app.database import get_db

        session = next(self.app.dependency_overrides[get_db]())
        try:
            hostel = models.Hostel(
                name="Reset Stay", owner_name="Owner", email="reset@example.com",
                password_hash="old", reset_token="missing-expiry-token",
                reset_token_expiry=None,
            )
            session.add(hostel)
            session.commit()
        finally:
            session.close()

        response = await self.client.post("/auth/reset-password", json={
            "token": "missing-expiry-token",
            "new_password": "NewStrongPassword123!",
        })
        self.assertEqual(response.status_code, 400, response.text)
        self.assertIn("expired", response.json()["detail"].lower())


if __name__ == "__main__":
    unittest.main()
