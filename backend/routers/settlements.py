import os
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user
from database import get_db
from models import Driver, Load, User, UserRole
from telegram_bot import send_settlement

router = APIRouter(tags=["settlements"])


def _week_bounds() -> tuple[date, date]:
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _week_loads(driver_id: int, db: Session) -> list[Load]:
    monday, sunday = _week_bounds()
    return (
        db.query(Load)
        .options(joinedload(Load.broker))
        .filter(
            Load.driver_id == driver_id,
            func.date(Load.created_at) >= monday,
            func.date(Load.created_at) <= sunday,
        )
        .order_by(Load.created_at.desc())
        .all()
    )


def _build_summary(driver: Driver, loads: list[Load]) -> dict:
    monday, sunday = _week_bounds()
    return {
        "driver_id": driver.id,
        "driver_name": driver.name,
        "telegram_chat_id": driver.telegram_chat_id,
        "week_start": monday.isoformat(),
        "week_end": sunday.isoformat(),
        "load_count": len(loads),
        "total_gross": sum(float(l.gross_rate) for l in loads),
        "total_net": sum(float(l.net_rate) for l in loads),
        "loads": [
            {
                "load_number": l.load_number,
                "broker_name": l.broker.name if l.broker else "",
                "gross_rate": float(l.gross_rate),
                "net_rate": float(l.net_rate),
                "pu_date": l.pu_date.isoformat() if l.pu_date else None,
                "approval_status": l.approval_status.value,
            }
            for l in loads
        ],
    }


@router.get("/settlements/summary/{driver_id}")
def get_summary(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.HEAD_ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Only HEAD_ACCOUNTANT can view settlements")

    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    return _build_summary(driver, _week_loads(driver_id, db))


@router.post("/settlements/send/{driver_id}")
def send_summary(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.HEAD_ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Only HEAD_ACCOUNTANT can send settlements")

    if not os.getenv("TELEGRAM_BOT_TOKEN"):
        raise HTTPException(
            status_code=400,
            detail="Telegram bot not configured — set TELEGRAM_BOT_TOKEN in .env",
        )

    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if not driver.telegram_chat_id:
        raise HTTPException(
            status_code=400,
            detail="Driver has no Telegram chat ID set — save a Chat ID first",
        )

    loads = _week_loads(driver_id, db)
    summary = _build_summary(driver, loads)
    monday, sunday = _week_bounds()

    lines = [
        "<b>📊 Weekly Settlement</b>",
        f"Week: {monday.strftime('%b %d')} – {sunday.strftime('%b %d, %Y')}",
        "",
        f"Driver: <b>{driver.name}</b>",
        f"Loads this week: <b>{summary['load_count']}</b>",
        f"Gross total: <b>${summary['total_gross']:,.2f}</b>",
        f"Net total: <b>${summary['total_net']:,.2f}</b>",
    ]

    if loads:
        lines.append("")
        lines.append("Loads:")
        for load in loads[:20]:  # cap to stay within Telegram message limit
            status_icon = {"APPROVED": "✅", "FLAGGED": "🚩", "PENDING": "⏳"}.get(
                load.approval_status.value, ""
            )
            lines.append(
                f"{status_icon} {load.load_number} — ${float(load.gross_rate):,.2f}"
            )
    else:
        lines.append("")
        lines.append("No loads recorded this week.")

    lines += ["", "<i>Sent via FreightDesk</i>"]

    try:
        send_settlement(driver.telegram_chat_id, "\n".join(lines))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Telegram send failed: {str(e)}")

    return {
        "sent": True,
        "chat_id": driver.telegram_chat_id,
        "load_count": summary["load_count"],
    }
