import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user
from database import get_db
from models import Load, User

router = APIRouter(tags=["reports"])


def _week_bounds():
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    return monday, monday + timedelta(days=6)


def _week_loads(db: Session):
    monday, sunday = _week_bounds()
    return (
        db.query(Load)
        .options(joinedload(Load.broker), joinedload(Load.driver))
        .filter(
            func.date(Load.created_at) >= monday,
            func.date(Load.created_at) <= sunday,
        )
        .order_by(Load.created_at.desc())
        .all()
    ), monday, sunday


@router.get("/weekly")
def weekly_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loads, monday, sunday = _week_loads(db)

    driver_map = {}
    for l in loads:
        key = l.driver_id
        name = l.driver.name if l.driver else "Unassigned"
        if key not in driver_map:
            driver_map[key] = {
                "driver_id": key,
                "driver_name": name,
                "loads": 0,
                "gross": 0.0,
                "net": 0.0,
            }
        driver_map[key]["loads"] += 1
        driver_map[key]["gross"] += float(l.gross_rate)
        driver_map[key]["net"] += float(l.net_rate)

    broker_map = {}
    for l in loads:
        key = l.broker_id
        name = l.broker.name if l.broker else ""
        if key not in broker_map:
            broker_map[key] = {
                "broker_id": key,
                "broker_name": name,
                "loads": 0,
                "gross": 0.0,
            }
        broker_map[key]["loads"] += 1
        broker_map[key]["gross"] += float(l.gross_rate)

    for b in broker_map.values():
        b["avg_rate"] = round(b["gross"] / b["loads"], 2) if b["loads"] > 0 else 0.0

    return {
        "week_start": monday.isoformat(),
        "week_end": sunday.isoformat(),
        "total_loads": len(loads),
        "total_gross": round(sum(float(l.gross_rate) for l in loads), 2),
        "total_net": round(sum(float(l.net_rate) for l in loads), 2),
        "driver_pnl": sorted(driver_map.values(), key=lambda x: x["gross"], reverse=True),
        "broker_performance": sorted(broker_map.values(), key=lambda x: x["gross"], reverse=True),
    }


@router.get("/export")
def export_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loads, monday, _ = _week_loads(db)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Load #", "Broker", "Driver", "PU Date", "DEL Date",
        "PU Location", "DEL Location", "Gross Rate", "Cut Rate",
        "Added Rate", "Net Rate", "Payment Method", "Payment Status",
        "Approval Status", "BOL Signed", "POD Submitted", "Created At",
    ])
    for l in loads:
        writer.writerow([
            l.load_number,
            l.broker.name if l.broker else "",
            l.driver.name if l.driver else "",
            l.pu_date.isoformat() if l.pu_date else "",
            l.del_date.isoformat() if l.del_date else "",
            l.pu_location or "",
            l.del_location or "",
            float(l.gross_rate),
            float(l.cut_rate),
            float(l.added_rate),
            float(l.net_rate),
            l.payment_method.value if l.payment_method else "",
            l.payment_status.value,
            l.approval_status.value,
            l.bol_signed,
            l.pod_submitted,
            l.created_at.isoformat() if l.created_at else "",
        ])

    output.seek(0)
    filename = f"freightdesk_week_{monday.isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
