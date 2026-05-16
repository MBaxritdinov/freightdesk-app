from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Broker, Load, User, UserRole

router = APIRouter(tags=["brokers"])


class BrokerCreate(BaseModel):
    name: str


class BrokerUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class BrokerResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    loads_count: int = 0

    class Config:
        from_attributes = True


def _get_or_404(broker_id: int, db: Session) -> Broker:
    broker = db.query(Broker).filter(Broker.id == broker_id).first()
    if not broker:
        raise HTTPException(status_code=404, detail="Broker not found")
    return broker


def _week_start() -> datetime:
    today = datetime.utcnow().date()
    return datetime.combine(today - timedelta(days=today.weekday()), datetime.min.time())


@router.get("", response_model=list[BrokerResponse])
def list_brokers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    brokers = db.query(Broker).order_by(Broker.name).all()
    week_start = _week_start()
    result = []
    for b in brokers:
        count = (
            db.query(Load)
            .filter(Load.broker_id == b.id, Load.created_at >= week_start)
            .count()
        )
        result.append(BrokerResponse(id=b.id, name=b.name, is_active=b.is_active, loads_count=count))
    return result


@router.post("", response_model=BrokerResponse, status_code=201)
def create_broker(
    payload: BrokerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.DISPATCHER:
        raise HTTPException(status_code=403, detail="Only DISPATCHER can create brokers")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Broker name cannot be empty")
    if db.query(Broker).filter(Broker.name == name).first():
        raise HTTPException(status_code=400, detail="A broker with this name already exists")
    broker = Broker(name=name, is_active=True)
    db.add(broker)
    db.commit()
    db.refresh(broker)
    return BrokerResponse(id=broker.id, name=broker.name, is_active=broker.is_active, loads_count=0)


@router.patch("/{broker_id}", response_model=BrokerResponse)
def update_broker(
    broker_id: int,
    payload: BrokerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.DISPATCHER:
        raise HTTPException(status_code=403, detail="Only DISPATCHER can update brokers")
    broker = _get_or_404(broker_id, db)
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Broker name cannot be empty")
        if db.query(Broker).filter(Broker.name == name, Broker.id != broker_id).first():
            raise HTTPException(status_code=400, detail="A broker with this name already exists")
        broker.name = name
    if payload.is_active is not None:
        broker.is_active = payload.is_active
    db.commit()
    db.refresh(broker)
    week_start = _week_start()
    count = (
        db.query(Load)
        .filter(Load.broker_id == broker.id, Load.created_at >= week_start)
        .count()
    )
    return BrokerResponse(id=broker.id, name=broker.name, is_active=broker.is_active, loads_count=count)


@router.delete("/{broker_id}", status_code=204)
def delete_broker(
    broker_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.DISPATCHER:
        raise HTTPException(status_code=403, detail="Only DISPATCHER can delete brokers")
    broker = _get_or_404(broker_id, db)
    if db.query(Load).filter(Load.broker_id == broker_id).first():
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a broker with assigned loads. Deactivate it instead.",
        )
    db.delete(broker)
    db.commit()
