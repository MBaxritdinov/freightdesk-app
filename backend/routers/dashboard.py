from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user
from database import get_db
from models import ApprovalStatus, Load, LoadStatus, User

router = APIRouter(tags=["dashboard"])

_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _week_bounds():
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    return monday, monday + timedelta(days=6)


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    monday, sunday = _week_bounds()
    today = date.today()

    week_loads = (
        db.query(Load)
        .options(joinedload(Load.broker), joinedload(Load.driver))
        .filter(
            func.date(Load.created_at) >= monday,
            func.date(Load.created_at) <= sunday,
        )
        .order_by(Load.created_at.desc())
        .all()
    )

    # ── HEAD_ACCOUNTANT stats ──────────────────────────────────────────────────
    total_loads_week = len(week_loads)
    gross_revenue_week = sum(float(l.gross_rate) for l in week_loads)
    net_revenue_week = sum(float(l.net_rate) for l in week_loads)
    pending_count = sum(1 for l in week_loads if l.approval_status == ApprovalStatus.PENDING)

    day_counts = {i: 0 for i in range(7)}
    for l in week_loads:
        if l.created_at:
            idx = (l.created_at.date() - monday).days
            if 0 <= idx <= 6:
                day_counts[idx] += 1
    loads_by_day = [{"day": _DAYS[i], "count": day_counts[i]} for i in range(7)]

    sc = {"PENDING": 0, "APPROVED": 0, "FLAGGED": 0}
    for l in week_loads:
        sc[l.approval_status.value] += 1
    loads_by_status = [{"status": k, "count": v} for k, v in sc.items()]

    # ── Pipeline stats (all loads, by LoadStatus) ──────────────────────────────
    pipeline_counts = {ls.value: 0 for ls in LoadStatus}
    all_loads_for_pipeline = db.query(Load).all()
    for l in all_loads_for_pipeline:
        ls = (l.load_status or LoadStatus.NEW).value
        pipeline_counts[ls] = pipeline_counts.get(ls, 0) + 1
    loads_by_status_pipeline = [{"status": k, "count": v} for k, v in pipeline_counts.items()]

    # ── Dispatcher stats ───────────────────────────────────────────────────────
    my_active_loads = db.query(Load).filter(
        Load.assigned_by == current_user.id,
        Load.driver_id.isnot(None),
        func.date(Load.created_at) >= monday,
        func.date(Load.created_at) <= sunday,
    ).count()

    in_route_count = db.query(Load).filter(Load.load_status == LoadStatus.IN_ROUTE).count()

    delivered_today_count = db.query(Load).filter(
        Load.load_status == LoadStatus.DELIVERED,
        func.date(Load.updated_at) == today,
    ).count()

    pending_acceptance_count = db.query(Load).filter(Load.load_status == LoadStatus.NEW).count()

    # Kanban: all non-delivered + today's delivered
    active_pipeline = (
        db.query(Load)
        .options(joinedload(Load.broker), joinedload(Load.driver))
        .filter(Load.load_status != LoadStatus.DELIVERED)
        .all()
    )
    delivered_today_loads = (
        db.query(Load)
        .options(joinedload(Load.broker), joinedload(Load.driver))
        .filter(
            Load.load_status == LoadStatus.DELIVERED,
            func.date(Load.updated_at) == today,
        )
        .all()
    )
    pipeline_loads = [
        {
            "id": l.id,
            "load_number": l.load_number,
            "broker_name": l.broker.name if l.broker else "",
            "driver_name": l.driver.name if l.driver else None,
            "pu_location": l.pu_location,
            "del_location": l.del_location,
            "gross_rate": float(l.gross_rate),
            "load_status": (l.load_status or LoadStatus.NEW).value,
        }
        for l in (active_pipeline + delivered_today_loads)
    ]

    # ── Recent 10 loads (all-time) ─────────────────────────────────────────────
    recent = (
        db.query(Load)
        .options(joinedload(Load.broker), joinedload(Load.driver))
        .order_by(Load.created_at.desc())
        .limit(10)
        .all()
    )
    recent_loads = [
        {
            "id": l.id,
            "load_number": l.load_number,
            "broker_name": l.broker.name if l.broker else "",
            "driver_name": l.driver.name if l.driver else None,
            "pu_location": l.pu_location,
            "del_location": l.del_location,
            "gross_rate": float(l.gross_rate),
            "approval_status": l.approval_status.value,
            "payment_status": l.payment_status.value,
            "load_status": (l.load_status or LoadStatus.NEW).value,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in recent
    ]

    return {
        "total_loads_week": total_loads_week,
        "gross_revenue_week": gross_revenue_week,
        "net_revenue_week": net_revenue_week,
        "pending_count": pending_count,
        "week_start": monday.isoformat(),
        "week_end": sunday.isoformat(),
        "loads_by_day": loads_by_day,
        "loads_by_status": loads_by_status,
        "loads_by_status_pipeline": loads_by_status_pipeline,
        "recent_loads": recent_loads,
        # dispatcher-specific
        "my_active_loads": my_active_loads,
        "in_route_count": in_route_count,
        "delivered_today_count": delivered_today_count,
        "pending_acceptance_count": pending_acceptance_count,
        "pipeline_loads": pipeline_loads,
    }
