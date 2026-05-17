import os

from auth import hash_password
from database import Base, SessionLocal, engine
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from limiter import limiter
from models import Broker, User, UserRole
from routers import auth as auth_router
from routers import bol as bol_module
from routers import brokers as brokers_router
from routers import dashboard as dashboard_router
from routers import documents as documents_router
from routers import drivers as drivers_router
from routers import gmail as gmail_router
from routers import gmail_settings as gmail_settings_router
from routers import loads as loads_router
from routers import notifications as notifications_router
from routers import reports as reports_router
from routers import search as search_router
from routers import settlements as settlements_router
from routers import telegram as telegram_router
from routers import users as users_router
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

# from gmail_poller import start_polling  # disabled - use manual Sync Now

app = FastAPI(title="FreightDesk API", version="0.1.0")

# Rate limiter
app.state.limiter = limiter


async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Too many requests, slow down"})


app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://freightdesk-app.vercel.app", "http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


app.add_middleware(SecurityHeadersMiddleware)

app.include_router(auth_router.router)
app.include_router(brokers_router.router, prefix="/brokers")
app.include_router(loads_router.router)
app.include_router(drivers_router.router, prefix="/drivers")
app.include_router(gmail_router.router)
app.include_router(gmail_settings_router.router, prefix="/gmail")
app.include_router(settlements_router.router)
app.include_router(telegram_router.router)
app.include_router(dashboard_router.router, prefix="/dashboard")
app.include_router(reports_router.router, prefix="/reports")
app.include_router(users_router.router, prefix="/users")
app.include_router(notifications_router.router, prefix="/notifications")
app.include_router(documents_router.router, prefix="/documents")
app.include_router(search_router.router, prefix="/search")
app.include_router(bol_module.loads_router, prefix="/loads")
app.include_router(bol_module.tracking_router)


def seed_data():
    admin_password = os.getenv("ADMIN_PASSWORD")
    if not admin_password:
        raise RuntimeError("ADMIN_PASSWORD env var is required")
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == "admin@freightdesk.io").first():
            admin = User(
                name="Admin",
                email="admin@freightdesk.io",
                hashed_password=hash_password(admin_password),
                role=UserRole.HEAD_ACCOUNTANT,
                is_active=True,
            )
            db.add(admin)

        broker_names = ["7 STAR", "RXO", "BBI", "CAL", "ALG", "AST", "MTC", "Freeway"]
        for name in broker_names:
            if not db.query(Broker).filter(Broker.name == name).first():
                db.add(Broker(name=name, is_active=True))

        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    seed_data()
    # start_polling(app)  # disabled - use manual Sync Now


@app.get("/")
def root():
    return {"message": "FreightDesk API is running"}
