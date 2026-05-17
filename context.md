# FreightDesk — Project Context

## What it is
AI-powered dispatch/accounting SaaS for Uzbek logistics companies managing US truck drivers and brokers.

## Stack
- Backend: FastAPI + PostgreSQL + SQLAlchemy 2.0 · Python 3.14
- Frontend: React + Vite + Tailwind CSS
- Auth: JWT via `frontend/src/auth.js` · axios interceptor in every page
- PDF: ReportLab · Distance: OpenRouteService API
- Notifications: Telegram bot · Email parsing: Gmail OAuth + Claude AI

## Roles & Access
| Feature | DISPATCHER | HEAD_ACCOUNTANT |
|---------|-----------|-----------------|
| Dashboard | Pipeline cards | Revenue charts |
| Loads | No payment cols | All cols |
| Drivers | ✅ | ❌ |
| Brokers | ✅ | ❌ |
| Reports | ❌ | ✅ |
| Users | ❌ | ✅ |
| Generate BOL | ✅ | ❌ |
| Generate Invoice | ❌ | ✅ |
| Edit/Delete Load | ✅ | ❌ |
| Approve/Flag Load | ❌ | ✅ |

## Auth Pattern (use in every new page/router)
```python
# Backend
from auth import get_current_user
current_user: User = Depends(get_current_user)
if current_user.role != UserRole.DISPATCHER:
    raise HTTPException(status_code=403)
```
```javascript
// Frontend — every page
import { getToken, clearToken } from '../auth'
const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
API.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

## Models (current)
User, Driver, Broker, Load, LoadEvent, Notification, GmailWhitelist

## Load Model Key Fields
load_number, broker_id, driver_id, load_status (NEW/ACCEPTED/DISPATCHED/IN_ROUTE/DELIVERED), approval_status (PENDING/APPROVED/FLAGGED), payment_status, payment_method, gross_rate, cut_rate, added_rate, final_rate, net_rate, quickpay_deduction, pu_location, pu_address, pu_date, pu_time_window, del_location, del_address, del_date, del_time_window, reference_number, weight, consignee_name, distance_miles, calculated_eta, driver_eta, eta_notes, bol_signed, pod_submitted, notes, email_source_id

## Load Status Flow
NEW → ACCEPTED → DISPATCHED → IN_ROUTE → DELIVERED (DISPATCHER only)

## Registered API Routers
/auth, /loads, /drivers, /brokers, /users, /dashboard, /reports, /documents, /gmail, /search, /notifications, /settlements, /telegram, /track (public)

## Pages
Dashboard, Loads, LoadDetail (/loads/:id), Drivers, Brokers, Reports, Users, Settings, TrackingPage (/track/:loadNumber — public)

## Shared Components
- `frontend/src/components/Navbar.jsx` — role-based nav links, search bar, notifications bell
- `frontend/src/auth.js` — getToken, setToken, clearToken

## Environment Variables
Local (.env)
DATABASE_URL=postgresql://postgres:iambignigga@localhost:5432/freightdesk
SECRET_KEY=<strong random key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
ANTHROPIC_API_KEY=...
TELEGRAM_BOT_TOKEN=...
ORS_API_KEY=...
ADMIN_PASSWORD=...
Railway (same keys, different values)
DATABASE_URL=postgresql://...railway internal url...
FRONTEND_URL=https://freightdesk-app.vercel.app

## Deployment
- Frontend: Vercel → https://freightdesk-app.vercel.app
- Backend: Railway → https://freightdesk-app-production.up.railway.app
- DB: Railway PostgreSQL · host: yamanote.proxy.rlwy.net:37561

## Known Bugs / TODO
- [ ] Confirm BOL layout with dispatcher friend
- [ ] Run DB migrations on Railway after new columns added
- [ ] Friend's full feature list pending
- [ ] Google Sheets integration (roadmap)
- [ ] Telegram bot: BOL/POD photo submission flow
- [ ] Multi-tenant architecture (future)
