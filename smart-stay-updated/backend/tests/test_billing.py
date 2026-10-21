import unittest
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app import models
from app.billing import (
    allocated_share,
    monthly_rent,
    payment_snapshot,
    payment_snapshots,
    tenant_account_totals,
    tenant_is_billable,
)


class BillingMathTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.hostel = models.Hostel(
            name="Test Stay", owner_name="Owner", email="billing@example.com",
            password_hash="test", upi_id="teststay@upi",
        )
        self.db.add(self.hostel)
        self.db.flush()
        self.room = models.Room(
            hostel_id=self.hostel.hostel_id, room_number="101",
            sharing_type="3", base_rent=6000, total_beds=3, occupied_beds=3,
        )
        self.db.add(self.room)
        self.db.flush()
        self.tenants = []
        for index in range(3):
            tenant = models.Tenant(
                hostel_id=self.hostel.hostel_id, room_id=self.room.room_id,
                name=f"Tenant {index + 1}", phone=f"900000000{index}",
                aadhaar_number=f"10000000000{index}", joining_date=date(2026, 1, 1),
                status="Active",
            )
            self.db.add(tenant)
            self.tenants.append(tenant)
        self.db.add_all([
            models.RentConfiguration(
                hostel_id=self.hostel.hostel_id, sharing_type="3",
                rent_amount=6000, effective_date=date(2026, 1, 1),
            ),
            models.RentConfiguration(
                hostel_id=self.hostel.hostel_id, sharing_type="3",
                rent_amount=6500, effective_date=date(2026, 3, 1),
            ),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_rent_change_uses_effective_month_not_latest_value(self):
        tenant = self.tenants[0]
        self.assertEqual(monthly_rent(tenant, "2026-02", self.db, self.hostel.hostel_id), 6000)
        self.assertEqual(monthly_rent(tenant, "2026-03", self.db, self.hostel.hostel_id), 6500)

    def test_exact_paise_split_never_loses_money(self):
        ids = [tenant.tenant_id for tenant in self.tenants]
        shares = [allocated_share(100, ids, tenant_id) for tenant_id in ids]
        self.assertEqual(shares, [33.34, 33.33, 33.33])
        self.assertEqual(round(sum(shares), 2), 100.00)

    def test_partial_payment_carries_only_real_opening_balance(self):
        tenant = self.tenants[0]
        january = models.Payment(
            hostel_id=self.hostel.hostel_id, tenant_id=tenant.tenant_id,
            month_year="2026-01", due_amount=6000, amount_paid=5000,
        )
        february = models.Payment(
            hostel_id=self.hostel.hostel_id, tenant_id=tenant.tenant_id,
            month_year="2026-02", due_amount=6000, amount_paid=2000,
        )
        self.db.add_all([january, february])
        self.db.commit()
        snapshot = payment_snapshot(self.db, february)
        self.assertEqual(snapshot["opening_balance"], 1000)
        self.assertEqual(snapshot["payable"], 7000)
        self.assertEqual(snapshot["balance"], 5000)
        self.assertEqual(snapshot["status"], "PARTIAL")

    def test_overpayment_becomes_credit_instead_of_disappearing(self):
        tenant = self.tenants[0]
        january = models.Payment(
            hostel_id=self.hostel.hostel_id, tenant_id=tenant.tenant_id,
            month_year="2026-01", due_amount=6000, amount_paid=6500,
        )
        february = models.Payment(
            hostel_id=self.hostel.hostel_id, tenant_id=tenant.tenant_id,
            month_year="2026-02", due_amount=6000, amount_paid=0,
        )
        self.db.add_all([january, february])
        self.db.commit()
        snapshot = payment_snapshot(self.db, february)
        self.assertEqual(snapshot["opening_credit"], 500)
        self.assertEqual(snapshot["payable"], 5500)
        totals = tenant_account_totals(self.db, self.hostel.hostel_id, tenant.tenant_id)
        self.assertEqual(totals["outstanding"], 5500)

    def test_unpaid_month_is_not_double_counted_after_carry_forward(self):
        tenant = self.tenants[0]
        january = models.Payment(
            hostel_id=self.hostel.hostel_id, tenant_id=tenant.tenant_id,
            month_year="2026-01", due_amount=6000, amount_paid=0,
        )
        february = models.Payment(
            hostel_id=self.hostel.hostel_id, tenant_id=tenant.tenant_id,
            month_year="2026-02", due_amount=6000, amount_paid=0,
        )
        self.db.add_all([january, february])
        self.db.commit()
        snaps = payment_snapshots(self.db, [january, february])
        self.assertEqual(snaps[january.payment_id]["status"], "CARRIED")
        self.assertEqual(snaps[january.payment_id]["balance"], 0)
        self.assertEqual(snaps[january.payment_id]["carried_forward"], 6000)
        self.assertEqual(snaps[february.payment_id]["balance"], 12000)
        total = sum(s["balance"] for s in snaps.values())
        totals = tenant_account_totals(self.db, self.hostel.hostel_id, tenant.tenant_id)
        self.assertEqual(total, totals["outstanding"])
        self.assertEqual(payment_snapshot(self.db, january)["status"], "CARRIED")

    def test_tenant_is_not_billed_before_joining_month(self):
        tenant = self.tenants[0]
        tenant.joining_date = date(2026, 4, 10)
        self.assertFalse(tenant_is_billable(tenant, "2026-03"))
        self.assertTrue(tenant_is_billable(tenant, "2026-04"))


if __name__ == "__main__":
    unittest.main()
