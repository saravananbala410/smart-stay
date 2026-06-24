# 🏠 Smart-Stay — PG / Hostel Management System

full-stack Web app for Mobile + Computer

---

## 📁 Project Structure

```
smart-stay/
├── backend/          ← Python FastAPI (Server)
└── frontend/         ← React + Vite (UI)
```

---

## ⚡ SETUP — Step by Step (VS Code la pannanum)

### STEP 1 — Software Install pannu

1. **Python** → https://www.python.org/downloads/ (3.11+ version download pannu)
2. **Node.js** → https://nodejs.org/ (LTS version download pannu)
3. **PostgreSQL** → https://www.postgresql.org/download/ (illa na Supabase free cloud use pannalam)
4. **VS Code** → https://code.visualstudio.com/

---

### STEP 2 — Project open pannu (VS Code)

1. VS Code open pannu
2. File → Open Folder → `smart-stay` folder select pannu
3. Terminal open pannu: **View → Terminal** (or Ctrl + `)

---

### STEP 3 — Database create pannu

**Local PostgreSQL use pannuviyaa:**
```sql
-- pgAdmin or psql la run pannu:
CREATE DATABASE smartstay;
```

**OR Supabase free cloud (recommended for beginners):**
1. https://supabase.com → Sign up
2. New Project create pannu
3. Settings → Database → Connection string copy pannu

---

### STEP 4 — Backend setup

Terminal la **backend folder** ku po:
```bash
cd backend
```

Virtual environment create pannu:
```bash
python -m venv venv
```

Activate pannu:
```bash
# Windows:
venv\Scripts\activate

# Mac/Linux:
source venv/bin/activate
```

Packages install pannu:
```bash
pip install -r requirements.txt
```

`.env` file create pannu (`.env.example` copy pannu):
```bash
# Windows:
copy .env.example .env

# Mac/Linux:
cp .env.example .env
```

`.env` file open pannu and update:
```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/smartstay
SECRET_KEY=any-long-random-string-here
CLOUDINARY_CLOUD_NAME=your_cloud_name   ← cloudinary.com la free account
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
SMTP_EMAIL=yourgmail@gmail.com          ← optional, for forgot password
SMTP_PASSWORD=your_gmail_app_password
```

Backend start pannu:
```bash
uvicorn app.main:app --reload
```

✅ `http://localhost:8000` la open aagum!
✅ `http://localhost:8000/docs` la API documentation paakalam!

---

### STEP 5 — Frontend setup

New terminal open pannu (+ button click pannu terminal la):
```bash
cd frontend
npm install
npm run dev
```

✅ `http://localhost:5173` la app open aagum!

---

### STEP 6 — Cloudinary setup (File Upload)

1. https://cloudinary.com → Free account create pannu
2. Dashboard la **Cloud Name, API Key, API Secret** copy pannu
3. Backend `.env` la paste pannu

---

## 📱 Mobile la run aganum

1. Unna computer la backend + frontend run aaganum
2. Phone and computer **same WiFi** la irukkanum
3. Computer IP address kandupidi:
   ```bash
   # Windows:
   ipconfig
   # Mac/Linux:
   ifconfig
   ```
4. Phone browser la: `http://192.168.x.x:5173` (unna computer IP)

---

## 🌐 Internet la deploy pannanum (Free)

### Backend → Railway.app (Free)
1. https://railway.app → GitHub account la login
2. New Project → Deploy from GitHub
3. Backend folder select pannu
4. Environment variables add pannu (from .env)

### Frontend → Vercel (Free)
1. https://vercel.com → GitHub login
2. New Project → frontend folder import
3. `vite.config.js` la proxy URL → Railway backend URL update pannu

---

## 🔑 API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Hostel register |
| `/api/auth/login` | POST | Login |
| `/api/auth/forgot-password` | POST | Password reset email |
| `/api/dashboard/stats` | GET | Dashboard numbers |
| `/api/rooms/` | GET/POST | List/Add rooms |
| `/api/rooms/rent-configuration/{type}` | PATCH | Update rent |
| `/api/tenants/` | GET/POST | List/Add tenants |
| `/api/tenants/{id}` | GET/PATCH | Profile/Update |
| `/api/tenants/{id}/payments` | GET | Payment history |
| `/api/payments/` | GET/POST | Payments |
| `/api/payments/generate-monthly` | POST | Auto-generate bills |
| `/api/reports/defaulters` | GET | Defaulters list |
| `/api/notices/` | GET/POST/DELETE | Notice board |

---

## ✅ Features

- 🔐 Secure JWT authentication
- 🏘️ Multi-tenant (multiple hostels)
- 📊 Dashboard with live stats
- 🛏️ Room management with occupancy tracking
- 💰 Dynamic rent configuration
- 👤 Tenant KYC (photo + Aadhaar PDF upload)
- 💳 Partial payment support with auto-arrears
- 📋 Defaulters report
- 📢 Notice board
- 📱 Mobile responsive UI

---

## 🐛 Common Issues

**"Module not found" error:**
```bash
pip install -r requirements.txt
```

**Database connection failed:**
- PostgreSQL service running a check pannu
- `.env` la DATABASE_URL correct a check pannu

**Port already in use:**
```bash
uvicorn app.main:app --reload --port 8001
```
