# FreightDesk — Claude Code Instructions

## First steps in every session
1. Read CONTEXT.md in the project root for full project context
2. Only read files directly relevant to the current task
3. Never read node_modules, __pycache__, or .git directories
4. State what files you will read before reading them

---

## Project structure
```
D:\FreightDesk_io\
├── backend/          # FastAPI Python backend
│   ├── main.py       # App entry point, router registration, startup
│   ├── models.py     # SQLAlchemy 2.0 models
│   ├── schemas.py    # Pydantic schemas
│   ├── auth.py       # JWT auth, get_current_user, hash_password
│   ├── database.py   # Engine, SessionLocal, get_db
│   ├── distance.py   # OpenRouteService distance/ETA calculator
│   ├── email_parser.py
│   ├── gmail_oauth.py
│   ├── gmail_poller.py
│   ├── telegram_bot.py
│   ├── seed_demo.py
│   └── routers/      # auth, loads, drivers, brokers, users, dashboard,
│                     # reports, documents, bol, gmail, gmail_settings,
│                     # search, notifications, settlements, telegram
└── frontend/
    └── src/
        ├── auth.js           # getToken, setToken, clearToken
        ├── App.jsx           # Routes
        ├── components/
        │   └── Navbar.jsx    # Role-based nav, search, notifications bell
        └── pages/
            # Dashboard, Loads, LoadDetail, Drivers, Brokers,
            # Reports, Users, Settings, TrackingPage
```

---

## Mandatory code patterns

### Backend — every protected endpoint
```python
from auth import get_current_user
from models import User, UserRole
from database import get_db

@router.post("/example")
def example(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.DISPATCHER:
        raise HTTPException(status_code=403, detail="Dispatcher only")
```

### Backend — new model fields (SQLAlchemy 2.0 style only)
```python
# CORRECT
field_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
field_name: Mapped[str] = mapped_column(String(200), nullable=False)
field_name: Mapped[Optional[float]] = mapped_column(nullable=True)

# NEVER USE (old style — breaks type checking)
field_name = Column(String(100), nullable=True)
```

### Frontend — every new page
```javascript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getToken, clearToken } from '../auth'
import Navbar from '../components/Navbar'

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })

API.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default function NewPage() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }
    setTimeout(() => {
      API.get('/auth/me')
        .then(r => setUser(r.data))
        .catch(() => { clearToken(); navigate('/login', { replace: true }) })
    }, 100)
  }, [])

  if (!user) return <div className="min-h-screen bg-slate-900" />

  const isDispatcher = user.role === 'DISPATCHER'
  const isHA = user.role === 'HEAD_ACCOUNTANT'

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar user={user} activePage="pagename" />
      {/* content */}
    </div>
  )
}
```

### Frontend — role-based rendering
```javascript
// Always use these variables
const isDispatcher = user?.role === 'DISPATCHER'
const isHA = user?.role === 'HEAD_ACCOUNTANT'

// Conditional rendering
{isDispatcher && <DispatcherOnlyComponent />}
{isHA && <AccountantOnlyComponent />}
```

---

## Role separation rules — NEVER violate these

| Feature | DISPATCHER | HEAD_ACCOUNTANT |
|---------|-----------|-----------------|
| Dashboard | Pipeline cards | Revenue charts |
| Loads table | No payment/method cols | All columns |
| Load Detail — Edit/Delete | ✅ | ❌ |
| Load Detail — Approve/Flag | ❌ | ✅ |
| Load Detail — Generate BOL | ✅ | ❌ |
| Load Detail — Generate Invoice | ❌ | ✅ |
| Load Detail — Driver ETA edit | ✅ | ❌ |
| Load status pipeline actions | ✅ | ❌ |
| Drivers page | ✅ | ❌ |
| Brokers page | ✅ | ❌ |
| Reports page | ❌ | ✅ |
| Users page | ❌ | ✅ |
| Settings page | Both | Both |
| Rate history panel | ✅ | ❌ |

---

## Things to NEVER change or break

- **bcrypt version**: pinned to `bcrypt==4.0.1` in requirements.txt — DO NOT upgrade
- **JWT sub field**: always encoded as string, decoded as int (`user_id = int(payload.get("sub"))`)
- **CORS**: `allow_origins=["*"]` with `allow_credentials=False` — don't change
- **Frontend token**: always use `getToken()`/`setToken()` from `../auth` — never use `localStorage` directly
- **SQLAlchemy style**: always use `Mapped[T] = mapped_column()` — never use old `Column()` style
- **Vite build**: `frontend/vercel.json` has `chmod +x node_modules/.bin/vite` — don't remove
- **SPA routing**: `frontend/vercel.json` has rewrites for React Router — don't remove
- **Public route**: `/track/:loadNumber` must stay public (no ProtectedRoute wrapper)

---

## When adding new database columns
Always remind the user to run migrations on BOTH local and Railway:

```sql
-- Local
-- $env:PGPASSWORD = "iambignigga"; & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d freightdesk -c "ALTER TABLE ..."

-- Railway
-- $env:PGPASSWORD="jdibTaOHwAiXyUnOPcaFPaxGJglvXHbh"; & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h yamanote.proxy.rlwy.net -p 37561 -U postgres -d railway -c "ALTER TABLE ..."
```

---

## When adding new API routers
Always register in `backend/main.py`:
```python
from routers import new_router
app.include_router(new_router.router, prefix="/new-prefix", tags=["new"])
```

---

## When adding new pages
Always add to `frontend/src/App.jsx`:
```javascript
import NewPage from './pages/NewPage'
// Protected route:
<Route path="/newpage" element={<ProtectedRoute><NewPage /></ProtectedRoute>} />
// Public route (no auth):
<Route path="/public" element={<PublicPage />} />
```

Always add link to `frontend/src/components/Navbar.jsx` with correct role restriction.

---

## Design system
- Background: `bg-slate-900` (page), `bg-slate-800` (cards/modals), `bg-slate-700` (inputs)
- Borders: `border-slate-700`
- Text: `text-white` (primary), `text-slate-400` (secondary)
- Primary action: `bg-blue-600 hover:bg-blue-700`
- Success: `bg-green-500` / `text-green-400`
- Warning: `bg-yellow-500` / `text-yellow-400`
- Danger: `bg-red-500` / `text-red-400`
- Badges: rounded-full, px-2 py-0.5, text-xs, font-medium
- Tables: `bg-slate-800` rows, `hover:bg-slate-750` on hover
- Always dark navy/slate — never light theme

---

## Never do
- Don't rewrite working features when adding new ones
- Don't change existing endpoint URLs (breaks frontend)
- Don't remove role checks from endpoints
- Don't add print statements or debug logs to production code
- Don't hardcode API keys or passwords
- Don't use `localStorage` directly in frontend (use auth.js)
- Don't use old SQLAlchemy Column() style
- Don't upgrade bcrypt above 4.0.1
- Don't wrap /track/:loadNumber in ProtectedRoute
- Don't run the Gmail background poller on startup (disabled to save API credits)

---

## Deployment reminders
- Push to GitHub → Railway auto-deploys backend, Vercel auto-deploys frontend
- After new columns: run ALTER TABLE on Railway manually
- After new features: test locally first, then push
- Frontend env var: VITE_API_URL must be set in Vercel project settings
- Backend env vars: set in Railway service Variables tab
