"""
Demo data seeder for FreightDesk.
Run from the backend/ directory:  python seed_demo.py

Clears all loads and drivers, then recreates 6 drivers and 30 loads
spread across the last 4 weeks. Admin user and brokers are preserved.
"""
import os
import random
import sys
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from database import Base, SessionLocal, engine
from models import (
    ApprovalStatus, Broker, Driver, DriverType,
    Load, PaymentMethod, PaymentStatus, User, UserRole,
)
from auth import hash_password

DRIVERS = [
    ("Alisher Karimov",   "COMPANY"),
    ("Bobur Yusupov",     "OWNER_OPERATOR"),
    ("Dilshod Nazarov",   "COMPANY"),
    ("Firdavs Toshmatov", "OWNER_OPERATOR"),
    ("Jasur Abdullayev",  "COMPANY"),
    ("Sanjar Mirzayev",   "COMPANY"),
]

ROUTES = [
    ("Chicago, IL",      "Dallas, TX"),
    ("Los Angeles, CA",  "Phoenix, AZ"),
    ("Atlanta, GA",      "New York, NY"),
    ("Houston, TX",      "Memphis, TN"),
    ("Denver, CO",       "Kansas City, MO"),
    ("Miami, FL",        "Charlotte, NC"),
    ("Seattle, WA",      "Portland, OR"),
    ("Detroit, MI",      "Columbus, OH"),
    ("Phoenix, AZ",      "Albuquerque, NM"),
    ("Nashville, TN",    "Louisville, KY"),
    ("Minneapolis, MN",  "Milwaukee, WI"),
    ("Las Vegas, NV",    "Salt Lake City, UT"),
    ("San Antonio, TX",  "Austin, TX"),
    ("Indianapolis, IN", "Cincinnati, OH"),
    ("Baltimore, MD",    "Philadelphia, PA"),
    ("Jacksonville, FL", "Birmingham, AL"),
    ("Oklahoma City, OK","Tulsa, OK"),
    ("Sacramento, CA",   "San Francisco, CA"),
]

LOAD_PREFIXES = {
    "7 STAR":  "7ST",
    "RXO":     "RXO",
    "BBI":     "BBI",
    "CAL":     "CAL",
    "ALG":     "ALG",
    "AST":     "AST",
    "MTC":     "MTC",
    "Freeway": "FWY",
}

random.seed(42)


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # ── Clear existing loads and drivers ────────────────────────────────────
        print("Clearing loads and drivers...")
        db.query(Load).delete()
        db.query(Driver).delete()
        db.commit()
        print("  done")

        # ── Verify prerequisites ────────────────────────────────────────────────
        brokers = db.query(Broker).filter(Broker.is_active == True).all()
        if not brokers:
            print("ERROR: No brokers found. Start the server once to seed brokers, then re-run.")
            return
        admin = db.query(User).filter(User.email == "admin@freightdesk.io").first()
        if not admin:
            print("ERROR: Admin user not found. Start the server once to seed the admin, then re-run.")
            return

        # ── Seed drivers ────────────────────────────────────────────────────────
        print("\nCreating drivers...")
        drivers = []
        for name, dtype in DRIVERS:
            d = Driver(name=name, driver_type=DriverType(dtype), is_active=True)
            db.add(d)
            db.flush()
            drivers.append(d)
            print(f"  + {name}  ({dtype})")
        db.commit()

        # ── Seed loads ──────────────────────────────────────────────────────────
        print("\nCreating 30 loads across the last 4 weeks...")
        today = date.today()

        # Fixed distribution pools (deterministic with seed=42)
        APPROVAL_DIST = ["APPROVED"] * 20 + ["PENDING"] * 7 + ["FLAGGED"] * 3
        PAYMENT_DIST  = ["PENDING"] * 12 + ["INVOICED"] * 10 + ["RECEIVED"] * 8
        PM_DIST       = ["RTS"] * 18 + ["QUICKPAY"] * 12
        random.shuffle(APPROVAL_DIST)
        random.shuffle(PAYMENT_DIST)
        random.shuffle(PM_DIST)

        # 8, 8, 7, 7 loads per week (oldest → newest)
        LOADS_PER_WEEK = [8, 8, 7, 7]
        idx = 0
        used_numbers: set[str] = set()

        for week_back, count in enumerate(reversed(LOADS_PER_WEEK)):
            # Monday of the target week
            week_monday = today - timedelta(days=today.weekday()) - timedelta(weeks=week_back)

            for _ in range(count):
                day_offset = random.randint(0, 6)
                load_date = week_monday + timedelta(days=day_offset)

                broker = random.choice(brokers)
                driver = random.choice(drivers)
                pu, dl = random.choice(ROUTES)

                gross = round(random.uniform(1800, 4500), 2)
                cut   = round(random.uniform(0, min(gross * 0.05, 200)), 2)
                added = round(random.uniform(0, 150), 2)
                final = round(gross - cut + added, 2)

                pm_str = PM_DIST[idx % len(PM_DIST)]
                qp     = round(final * 0.02, 2) if pm_str == "QUICKPAY" else 0.0
                net    = round(final - qp, 2)

                approval = ApprovalStatus(APPROVAL_DIST[idx % len(APPROVAL_DIST)])
                payment  = PaymentStatus(PAYMENT_DIST[idx % len(PAYMENT_DIST)])

                prefix = LOAD_PREFIXES.get(broker.name, "FD")
                # Generate unique load number
                while True:
                    num = f"{prefix}-{random.randint(10000, 99999)}"
                    if num not in used_numbers:
                        used_numbers.add(num)
                        break

                pu_date  = load_date
                del_date = load_date + timedelta(days=random.randint(1, 3))

                created_ts = datetime(
                    load_date.year, load_date.month, load_date.day,
                    random.randint(6, 18), random.randint(0, 59),
                    tzinfo=timezone.utc,
                )

                load = Load(
                    load_number=num,
                    broker_id=broker.id,
                    driver_id=driver.id,
                    pu_date=pu_date,
                    del_date=del_date,
                    pu_location=pu,
                    del_location=dl,
                    gross_rate=gross,
                    cut_rate=cut,
                    added_rate=added,
                    final_rate=final,
                    payment_method=PaymentMethod(pm_str),
                    quickpay_deduction=qp,
                    net_rate=net,
                    payment_status=payment,
                    approval_status=approval,
                    assigned_by=admin.id,
                    approved_by=admin.id if approval == ApprovalStatus.APPROVED else None,
                    bol_signed=(approval == ApprovalStatus.APPROVED),
                    pod_submitted=(payment in (PaymentStatus.INVOICED, PaymentStatus.RECEIVED)),
                    created_at=created_ts,
                )
                db.add(load)
                print(f"  + {num:14s}  {pu:22s} -> {dl:22s}  ${gross:>8,.2f}  {approval.value}")
                idx += 1

        db.commit()
        total_gross = sum(
            float(l.gross_rate) for l in db.query(Load).all()
        )
        print(f"\nDone. 6 drivers and 30 loads created. Total gross: ${total_gross:,.2f}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
