# Smart Stay — Android app

The app (in `frontend/android`) is the same React UI packaged with Capacitor.
It talks to the FastAPI backend over the network, so the backend must be running
and reachable from the phone.

## 1. Start the backend so the phone can reach it

```bash
cd backend
.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Find the computer's WiFi IP with `ipconfig` (e.g. `192.168.1.10`). Phone and
computer must be on the same WiFi. Allow port 8000 in Windows Firewall if asked.

## 2. Get the APK

**Option A — GitHub (no Android Studio needed):** push this repo to GitHub, open
*Actions → Build Android APK → Run workflow*, then download `smart-stay-apk`
and install `app-debug.apk` on the phone (allow "Install unknown apps").

**Option B — Android Studio:** install Android Studio, then

```bash
cd frontend
npm run cap:sync
npm run cap:open      # opens Android Studio → Run ▶ or Build → Build APK
```

## 3. First launch

The login screen asks for the **Server address** — enter
`http://<computer-ip>:8000` (or your hosted backend URL) and tap
*Save & connect*. You can change it later from the "Server: … · change" link.

## Quick alternative (no install)

Run `npm run dev` in `frontend`, open `http://<computer-ip>:5173` in the phone's
Chrome, then menu → *Add to Home screen*.

## Notes

- Tenant payment links (`/pay/...`) open in the tenant's browser, so set
  `FRONTEND_PUBLIC_URL` in `backend/.env` to a web address tenants can open.
- After any frontend change run `npm run cap:sync` before rebuilding the APK.
