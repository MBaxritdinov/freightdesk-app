from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Broker, Driver, Load, User
from schemas import SearchBroker, SearchDriver, SearchLoad, SearchResponse

router = APIRouter(tags=["search"])


@router.get("", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")

    pattern = f"%{q.strip()}%"

    loads = (
        db.query(Load)
        .join(Load.broker)
        .filter(
            Load.load_number.ilike(pattern)
            | Load.pu_location.ilike(pattern)
            | Load.del_location.ilike(pattern)
        )
        .order_by(Load.created_at.desc())
        .limit(5)
        .all()
    )

    drivers = (
        db.query(Driver)
        .filter(Driver.name.ilike(pattern))
        .order_by(Driver.name)
        .limit(5)
        .all()
    )

    brokers = (
        db.query(Broker)
        .filter(Broker.name.ilike(pattern) | Broker.full_name.ilike(pattern))
        .order_by(Broker.name)
        .limit(5)
        .all()
    )

    return SearchResponse(
        loads=[
            SearchLoad(
                id=l.id,
                load_number=l.load_number,
                broker_name=l.broker.name if l.broker else "",
                pu_location=l.pu_location,
                del_location=l.del_location,
            )
            for l in loads
        ],
        drivers=[SearchDriver(id=d.id, name=d.name) for d in drivers],
        brokers=[SearchBroker(id=b.id, name=b.name) for b in brokers],
    )
