# Smart Stay production readiness

The application now has deterministic billing math, tenant-specific UPI requests,
admin verification, tenant-visible payment status, PDF receipts, responsive
navigation, database uniqueness guards and bulk ledger queries.

## Payment calculation used everywhere

For each billing month:

1. Current charges = room rent + exact electricity share + exact additional-charge share.
2. Opening balance = all earlier generated bills - all earlier received payments.
3. Total payable = current charges + previous balance - opening credit.
4. Remaining = total payable - payments received for the selected month.
5. An overpayment is retained as credit and applied to the next generated bill.

Splits are allocated in paise. For example, INR 100 split across three tenants is
INR 33.34 + INR 33.33 + INR 33.33, never INR 99.99.

## Before a public market launch

- Use PostgreSQL or a managed PostgreSQL service. SQLite WAL is suitable for a
  local demo, but it is not the production database for concurrent commercial traffic.
- Run database migrations before every deployment and take automated, tested backups.
- Put the API behind HTTPS and set `APP_ENV=production`, a long random `SECRET_KEY`,
  exact `ALLOWED_ORIGINS`, `BASE_URL`, and `FRONTEND_PUBLIC_URL` values.
- Connect an Indian payment gateway such as Razorpay or Cashfree and verify signed
  webhooks. The included UPI flow deliberately requires admin verification; a UPI
  reference entered by a tenant is not treated as proof of payment.
- Connect an approved WhatsApp Business provider/template. The app prepares a
  tenant-specific WhatsApp message and secure payment link; provider credentials
  and a deployment scheduler are required for automatic due-date delivery.
- Use a background queue for SMS, WhatsApp, email, PDF and file-upload jobs when
  traffic grows. Do not run long provider calls inside web workers.
- Store uploads in object storage, enable malware/file-type checks, add rate limits,
  central logs, error monitoring and uptime alerts.
- Run load tests against a staging environment that matches production worker,
  database and network settings. No code-only change can guarantee zero hangs.

## Verification commands

```powershell
cd backend
python -m unittest discover -s tests -v

cd ..\frontend
npm run build
```
