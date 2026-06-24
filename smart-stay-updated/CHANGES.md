# Smart-Stay v2.0 — Bug Fixes & New Features

## Bug Fixes

### 1. Payment Amount Calculation (Bug Fix)
- **Problem**: Payment page wasn't showing correct amount per tenant
- **Fix**: `payments.py` → `get_total_due_for_tenant()` calculates:
  - Base rent + Electricity share + Additional charges share
  - Joining date: Jan 10, 2026 → Today Apr 10, 2026 = 4 months × ₹7000 = ₹28000
  - Already paid ₹14000 → Balance = ₹14000 ✅

### 2. Active/Vacated Tenant Separation (Bug Fix)
- **Problem**: All tenants shown together
- **Fix**: `Tenants.jsx` has Active/Vacated tabs
- Backend records `vacated_date` when tenant is marked vacated

### 3. No Duplicate Payment Entries (Bug Fix)
- **Problem**: Multiple payments adding duplicate rows
- **Fix**: One record per tenant per month. Extra payments just add to `amount_paid`

### 4. Tenant Photo Display (Bug Fix)
- **Problem**: Photo not showing — shows "RA" initials instead of image
- **Fix**: 
  - `file_upload.py` now saves locally if Cloudinary not configured
  - Frontend uses CSS `display:none/flex` trick — letter only shows if image fails
  - `onError` handler properly reveals fallback

### 5. Dashboard Details (Enhancement)
- Added: Hostel image + address banner at top
- Added: Vacant rooms list (which room has how many free beds)
- Added: Occupancy summary (Active, Vacated, Vacant beds)
- Added: "Edit Hostel Info" modal to set address + image URL

### 6. Notice Board SMS (Enhancement)
- **Problem**: Notice posted but tenants not notified
- **Fix**: `notices.py` calls `send_sms_to_tenants()` on every new notice
- Uses **Twilio** if configured in `.env`, otherwise logs to console
- To enable: Add `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM` to `.env`

### 7. Electricity Bill (New Feature)
- New model: `ElectricityBill` (room-wise, per month)
- New API: `POST /api/charges/electricity`
- Room 101, ₹3000, 6 active tenants → ₹500 each auto-split
- Updates existing payment records immediately
- Admin can change each month (upsert logic)

### 8. Add Feature / Custom Charges (New Feature)
- New model: `AdditionalCharge` (hostel-wide, per month)
- New API: `POST /api/charges/additional`
- Admin types "Water" + ₹1000 → splits across ALL active tenants
- Multiple charges supported (Water + Internet + Maintenance, etc.)

### 9. Bill Report (Enhancement)
- `Reports.jsx` completely rewritten
- Shows hostel name + address in header
- Electricity bill table with per-tenant breakdown
- Additional charges table
- Tenant-wise payment table with: Rent | Electricity | Other | Arrears | Total Due | Paid | Balance | Date
- Grand totals row
- **Print to PDF** button with proper print CSS

---

## New Files
- `backend/app/routers/electricity.py` — Electricity & Additional Charges API
- `backend/app/models.py` — Added `ElectricityBill`, `AdditionalCharge`, `vacated_date`, `address`, `image_url`

## New API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/charges/electricity` | Set room electricity bill |
| GET  | `/api/charges/electricity` | List electricity bills |
| POST | `/api/charges/additional`  | Add water/internet/etc charge |
| GET  | `/api/charges/additional`  | List additional charges |
| PATCH| `/api/dashboard/hostel-info` | Update hostel address & image |

## Setup Notes
- Run `pip install -r requirements.txt` (added `python-dateutil`)
- The new DB tables auto-create on first `uvicorn` start
- For SMS: Add Twilio credentials to `.env`
- For real image hosting: Add Cloudinary credentials to `.env`
