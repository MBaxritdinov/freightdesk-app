from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class LoginRequest(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class LoadCreate(BaseModel):
    load_number: str
    broker_id: int
    driver_id: Optional[int] = None
    pu_date: Optional[date] = None
    del_date: Optional[date] = None
    pu_location: Optional[str] = None
    del_location: Optional[str] = None
    gross_rate: float
    cut_rate: Optional[float] = 0
    added_rate: Optional[float] = 0
    payment_method: Optional[str] = None
    quickpay_deduction: Optional[float] = 0
    notes: Optional[str] = None
    pu_address: Optional[str] = None
    del_address: Optional[str] = None
    pu_time_window: Optional[str] = None
    del_time_window: Optional[str] = None
    reference_number: Optional[str] = None
    weight: Optional[str] = None
    consignee_name: Optional[str] = None


class FlagRequest(BaseModel):
    reason: Optional[str] = None


class LoadStatusUpdate(BaseModel):
    status: str


class LoadResponse(BaseModel):
    id: int
    load_number: str
    broker_id: int
    broker_name: str
    driver_id: Optional[int] = None
    driver_name: Optional[str] = None
    pu_date: Optional[date] = None
    del_date: Optional[date] = None
    pu_location: Optional[str] = None
    del_location: Optional[str] = None
    gross_rate: float
    cut_rate: float
    added_rate: float
    final_rate: float
    quickpay_deduction: float
    net_rate: float
    payment_method: Optional[str] = None
    payment_status: str
    approval_status: str
    load_status: str
    bol_signed: bool
    pod_submitted: bool
    notes: Optional[str] = None
    email_source_id: Optional[str] = None
    approved_by: Optional[int] = None
    approved_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    pu_address: Optional[str] = None
    del_address: Optional[str] = None
    pu_time_window: Optional[str] = None
    del_time_window: Optional[str] = None
    reference_number: Optional[str] = None
    weight: Optional[str] = None
    consignee_name: Optional[str] = None
    distance_miles: Optional[float] = None
    calculated_eta: Optional[datetime] = None
    driver_eta: Optional[datetime] = None
    eta_notes: Optional[str] = None


class PaginatedLoads(BaseModel):
    items: List[LoadResponse]
    total: int
    page: int
    pages: int


class LoadEventResponse(BaseModel):
    id: int
    load_id: int
    event_type: str
    description: str
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DriverListResponse(BaseModel):
    id: int
    name: str


class DriverCreate(BaseModel):
    name: str
    driver_type: Optional[str] = "COMPANY"


class DriverUpdate(BaseModel):
    name: Optional[str] = None
    driver_type: Optional[str] = None


class DriverResponse(BaseModel):
    id: int
    name: str
    driver_type: str
    is_active: bool
    telegram_chat_id: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TelegramIdUpdate(BaseModel):
    telegram_chat_id: Optional[str] = None


class LoadUpdate(BaseModel):
    bol_signed: Optional[bool] = None
    pod_submitted: Optional[bool] = None
    notes: Optional[str] = None
    driver_id: Optional[int] = None
    payment_status: Optional[str] = None
    pu_location: Optional[str] = None
    del_location: Optional[str] = None
    pu_address: Optional[str] = None
    del_address: Optional[str] = None
    pu_time_window: Optional[str] = None
    del_time_window: Optional[str] = None
    reference_number: Optional[str] = None
    weight: Optional[str] = None
    consignee_name: Optional[str] = None


class DriverEtaUpdate(BaseModel):
    driver_eta: Optional[datetime] = None
    eta_notes: Optional[str] = None


class BrokerListResponse(BaseModel):
    id: int
    name: str


class NotificationResponse(BaseModel):
    id: int
    message: str
    is_read: bool
    link: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GmailWhitelistCreate(BaseModel):
    email_pattern: str


class GmailWhitelistResponse(BaseModel):
    id: int
    email_pattern: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SearchLoad(BaseModel):
    id: int
    load_number: str
    broker_name: str
    pu_location: Optional[str] = None
    del_location: Optional[str] = None


class SearchDriver(BaseModel):
    id: int
    name: str


class SearchBroker(BaseModel):
    id: int
    name: str


class SearchResponse(BaseModel):
    loads: List[SearchLoad]
    drivers: List[SearchDriver]
    brokers: List[SearchBroker]
