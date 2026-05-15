from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Driver, DriverType, User, UserRole
from schemas import DriverCreate, DriverUpdate, DriverResponse, TelegramIdUpdate
from auth import get_current_user

router = APIRouter(tags=["drivers"])


def _get_or_404(driver_id: int, db: Session) -> Driver:
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


def _to_response(driver: Driver) -> DriverResponse:
    return DriverResponse(
        id=driver.id,
        name=driver.name,
        driver_type=driver.driver_type.value,
        is_active=driver.is_active,
        telegram_chat_id=driver.telegram_chat_id,
        created_at=driver.created_at,
    )


@router.get("", response_model=list[DriverResponse])
def list_drivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    drivers = db.query(Driver).order_by(Driver.name).all()
    return [_to_response(d) for d in drivers]


@router.post("", response_model=DriverResponse, status_code=201)
def create_driver(
    payload: DriverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        dt = DriverType(payload.driver_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid driver_type: {payload.driver_type}")

    driver = Driver(name=payload.name, driver_type=dt)
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return _to_response(driver)


@router.patch("/{driver_id}/deactivate", response_model=DriverResponse)
def deactivate_driver(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.HEAD_ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Only HEAD_ACCOUNTANT can deactivate drivers")
    driver = _get_or_404(driver_id, db)
    driver.is_active = False
    db.commit()
    db.refresh(driver)
    return _to_response(driver)


@router.patch("/{driver_id}/activate", response_model=DriverResponse)
def activate_driver(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.HEAD_ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Only HEAD_ACCOUNTANT can activate drivers")
    driver = _get_or_404(driver_id, db)
    driver.is_active = True
    db.commit()
    db.refresh(driver)
    return _to_response(driver)


@router.patch("/{driver_id}/telegram", response_model=DriverResponse)
def set_telegram(
    driver_id: int,
    payload: TelegramIdUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = _get_or_404(driver_id, db)
    driver.telegram_chat_id = payload.telegram_chat_id
    db.commit()
    db.refresh(driver)
    return _to_response(driver)


@router.patch("/{driver_id}", response_model=DriverResponse)
def update_driver(
    driver_id: int,
    payload: DriverUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = _get_or_404(driver_id, db)
    if payload.name is not None:
        driver.name = payload.name
    if payload.driver_type is not None:
        try:
            driver.driver_type = DriverType(payload.driver_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid driver_type: {payload.driver_type}")
    db.commit()
    db.refresh(driver)
    return _to_response(driver)
