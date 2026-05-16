import logging
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user
from database import get_db
from models import (
    ApprovalStatus, Broker, Driver, Load, LoadEvent, LoadStatus,
    Notification, PaymentMethod, PaymentStatus, User, UserRole,
)
from schemas import (
    BrokerListResponse,
    FlagRequest,
    LoadCreate,
    LoadEventResponse,
    LoadResponse,
    LoadStatusUpdate,
    LoadUpdate,
    PaginatedLoads,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["loads"])

# Valid lifecycle transitions — only DISPATCHER can advance
_TRANSITIONS = {
    LoadStatus.NEW: LoadStatus.ACCEPTED,
    LoadStatus.ACCEPTED: LoadStatus.DISPATCHED,
    LoadStatus.DISPATCHED: LoadStatus.IN_ROUTE,
    LoadStatus.IN_ROUTE: LoadStatus.DELIVERED,
}

_TRANSITION_LABELS = {
    LoadStatus.ACCEPTED: "accepted",
    LoadStatus.DISPATCHED: "dispatched",
    LoadStatus.IN_ROUTE: "in route",
    LoadStatus.DELIVERED: "delivered",
}


def _to_response(load: Load) -> LoadResponse:
    return LoadResponse(
        id=load.id,
        load_number=load.load_number,
        broker_id=load.broker_id,
        broker_name=load.broker.name if load.broker else "",
        driver_id=load.driver_id,
        driver_name=load.driver.name if load.driver else None,
        pu_date=load.pu_date,
        del_date=load.del_date,
        pu_location=load.pu_location,
        del_location=load.del_location,
        gross_rate=float(load.gross_rate),
        cut_rate=float(load.cut_rate),
        added_rate=float(load.added_rate),
        final_rate=float(load.final_rate),
        quickpay_deduction=float(load.quickpay_deduction),
        net_rate=float(load.net_rate),
        payment_method=load.payment_method.value if load.payment_method else None,
        payment_status=load.payment_status.value,
        approval_status=load.approval_status.value,
        load_status=(load.load_status.value if load.load_status else LoadStatus.NEW.value),
        bol_signed=load.bol_signed,
        pod_submitted=load.pod_submitted,
        notes=load.notes,
        email_source_id=load.email_source_id,
        approved_by=load.approved_by,
        approved_by_name=load.approver.name if load.approver else None,
        created_at=load.created_at,
    )


def _get_load_or_404(load_id: int, db: Session) -> Load:
    load = (
        db.query(Load)
        .options(
            joinedload(Load.broker),
            joinedload(Load.driver),
            joinedload(Load.approver),
        )
        .filter(Load.id == load_id)
        .first()
    )
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")
    return load


def _notify_ha(db: Session, message: str, link: Optional[str] = None, exclude_user_id: Optional[int] = None):
    ha_users = db.query(User).filter(
        User.role == UserRole.HEAD_ACCOUNTANT,
        User.is_active == True,
    ).all()
    for u in ha_users:
        if exclude_user_id is None or u.id != exclude_user_id:
            db.add(Notification(user_id=u.id, message=message, link=link))


def _try_telegram(load: Load) -> None:
    if not load.driver or not load.driver.telegram_chat_id:
        return
    try:
        from telegram_bot import send_load_notification
        send_load_notification(
            load.driver.telegram_chat_id,
            {
                "load_number": load.load_number,
                "broker_name": load.broker.name if load.broker else "",
                "pu_location": load.pu_location,
                "del_location": load.del_location,
                "pu_date": str(load.pu_date) if load.pu_date else None,
                "gross_rate": float(load.gross_rate),
            },
        )
    except Exception as e:
        logger.warning(f"Telegram send failed for load {load.id}: {e}")


@router.get("/loads", response_model=PaginatedLoads)
def list_loads(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    load_status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Load).options(
        joinedload(Load.broker),
        joinedload(Load.driver),
        joinedload(Load.approver),
    )

    if status:
        try:
            query = query.filter(Load.approval_status == ApprovalStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    if payment_status:
        try:
            query = query.filter(Load.payment_status == PaymentStatus(payment_status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid payment_status: {payment_status}")

    if load_status:
        try:
            query = query.filter(Load.load_status == LoadStatus(load_status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid load_status: {load_status}")

    total = query.count()
    loads = query.order_by(Load.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return PaginatedLoads(
        items=[_to_response(l) for l in loads],
        total=total,
        page=page,
        pages=max(1, math.ceil(total / limit)),
    )


@router.get("/loads/{load_id}", response_model=LoadResponse)
def get_load(
    load_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _to_response(_get_load_or_404(load_id, db))


@router.post("/loads", response_model=LoadResponse, status_code=201)
def create_load(
    payload: LoadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(Broker).filter(Broker.id == payload.broker_id).first():
        raise HTTPException(status_code=404, detail="Broker not found")

    if payload.driver_id and not db.query(Driver).filter(Driver.id == payload.driver_id).first():
        raise HTTPException(status_code=404, detail="Driver not found")

    if payload.payment_method:
        try:
            pm = PaymentMethod(payload.payment_method)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid payment_method: {payload.payment_method}")
    else:
        pm = None

    gross = float(payload.gross_rate)
    cut = float(payload.cut_rate or 0)
    added = float(payload.added_rate or 0)
    qp = float(payload.quickpay_deduction or 0)
    final_rate = gross - cut + added
    net_rate = final_rate - qp

    load = Load(
        load_number=payload.load_number,
        broker_id=payload.broker_id,
        driver_id=payload.driver_id,
        pu_date=payload.pu_date,
        del_date=payload.del_date,
        pu_location=payload.pu_location,
        del_location=payload.del_location,
        gross_rate=gross,
        cut_rate=cut,
        added_rate=added,
        final_rate=final_rate,
        payment_method=pm,
        quickpay_deduction=qp,
        net_rate=net_rate,
        notes=payload.notes,
        assigned_by=current_user.id,
        load_status=LoadStatus.NEW,
    )
    db.add(load)
    db.flush()

    db.add(LoadEvent(
        load_id=load.id,
        event_type="CREATED",
        description="Load created",
        created_by=current_user.id,
    ))

    _notify_ha(db, f"New load {load.load_number} added", f"/loads/{load.id}")
    db.commit()

    fresh = _get_load_or_404(load.id, db)
    if payload.driver_id:
        _try_telegram(fresh)
    return _to_response(fresh)


@router.patch("/loads/{load_id}", response_model=LoadResponse)
def update_load(
    load_id: int,
    payload: LoadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    load = _get_load_or_404(load_id, db)
    if payload.bol_signed is not None:
        load.bol_signed = payload.bol_signed
    if payload.pod_submitted is not None:
        load.pod_submitted = payload.pod_submitted
    if payload.notes is not None:
        load.notes = payload.notes
    if payload.driver_id is not None:
        if not db.query(Driver).filter(Driver.id == payload.driver_id).first():
            raise HTTPException(status_code=404, detail="Driver not found")
        load.driver_id = payload.driver_id
    if payload.payment_status is not None:
        try:
            load.payment_status = PaymentStatus(payload.payment_status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid payment_status: {payload.payment_status}")
    db.commit()
    return _to_response(_get_load_or_404(load_id, db))


@router.patch("/loads/{load_id}/status", response_model=LoadResponse)
def update_load_status(
    load_id: int,
    payload: LoadStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.DISPATCHER:
        raise HTTPException(status_code=403, detail="Only DISPATCHER can advance the load pipeline")

    try:
        new_status = LoadStatus(payload.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {payload.status}")

    load = _get_load_or_404(load_id, db)
    current_status = load.load_status or LoadStatus.NEW

    expected_next = _TRANSITIONS.get(current_status)
    if expected_next is None:
        raise HTTPException(status_code=400, detail="Load is already at final status DELIVERED")
    if new_status != expected_next:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition: {current_status.value} → {new_status.value}. Expected next: {expected_next.value}",
        )

    if new_status == LoadStatus.DISPATCHED and not load.driver_id:
        raise HTTPException(status_code=400, detail="Assign a driver before dispatching")

    load.load_status = new_status

    if new_status == LoadStatus.DELIVERED:
        load.pod_submitted = True

    db.add(LoadEvent(
        load_id=load.id,
        event_type=new_status.value,
        description=f"Load marked as {_TRANSITION_LABELS[new_status]}",
        created_by=current_user.id,
    ))

    db.commit()

    fresh = _get_load_or_404(load_id, db)

    if new_status == LoadStatus.DISPATCHED:
        _try_telegram(fresh)

    return _to_response(fresh)


@router.get("/loads/{load_id}/events", response_model=list[LoadEventResponse])
def get_load_events(
    load_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(Load).filter(Load.id == load_id).first():
        raise HTTPException(status_code=404, detail="Load not found")

    events = (
        db.query(LoadEvent)
        .options(joinedload(LoadEvent.creator))
        .filter(LoadEvent.load_id == load_id)
        .order_by(LoadEvent.created_at.asc())
        .all()
    )

    return [
        LoadEventResponse(
            id=e.id,
            load_id=e.load_id,
            event_type=e.event_type,
            description=e.description,
            created_by=e.created_by,
            created_by_name=e.creator.name if e.creator else None,
            created_at=e.created_at,
        )
        for e in events
    ]


@router.patch("/loads/{load_id}/approve", response_model=LoadResponse)
def approve_load(
    load_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.HEAD_ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Only HEAD_ACCOUNTANT can approve loads")

    load = _get_load_or_404(load_id, db)
    load.approval_status = ApprovalStatus.APPROVED
    load.approved_by = current_user.id
    _notify_ha(db, f"Load {load.load_number} approved", f"/loads/{load.id}", exclude_user_id=current_user.id)
    db.commit()
    return _to_response(_get_load_or_404(load_id, db))


@router.patch("/loads/{load_id}/flag", response_model=LoadResponse)
def flag_load(
    load_id: int,
    payload: FlagRequest = Body(default=FlagRequest()),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.HEAD_ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Only HEAD_ACCOUNTANT can flag loads")

    load = _get_load_or_404(load_id, db)
    load.approval_status = ApprovalStatus.FLAGGED
    if payload and payload.reason:
        load.notes = f"{load.notes}\n[FLAGGED]: {payload.reason}" if load.notes else payload.reason
    _notify_ha(db, f"Load {load.load_number} flagged", f"/loads/{load.id}", exclude_user_id=current_user.id)
    db.commit()
    return _to_response(_get_load_or_404(load_id, db))


@router.get("/brokers", response_model=list[BrokerListResponse])
def list_brokers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    brokers = db.query(Broker).filter(Broker.is_active == True).order_by(Broker.name).all()
    return [BrokerListResponse(id=b.id, name=b.name) for b in brokers]
