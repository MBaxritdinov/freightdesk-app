import enum
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (
    Integer, String, Boolean, DateTime, Date, Text,
    Numeric, ForeignKey, Enum, Float, func
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from database import Base


class UserRole(str, enum.Enum):
    DISPATCHER = "DISPATCHER"
    HEAD_ACCOUNTANT = "HEAD_ACCOUNTANT"
    ACCOUNTANT = "ACCOUNTANT"


class DriverType(str, enum.Enum):
    COMPANY = "COMPANY"
    OWNER_OPERATOR = "OWNER_OPERATOR"


class PaymentMethod(str, enum.Enum):
    RTS = "RTS"
    QUICKPAY = "QUICKPAY"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    INVOICED = "INVOICED"
    RECEIVED = "RECEIVED"


class ApprovalStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    FLAGGED = "FLAGGED"


class LoadStatus(str, enum.Enum):
    NEW = "NEW"
    ACCEPTED = "ACCEPTED"
    DISPATCHED = "DISPATCHED"
    IN_ROUTE = "IN_ROUTE"
    DELIVERED = "DELIVERED"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.ACCOUNTANT)
    telegram_chat_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    driver_type: Mapped[DriverType] = mapped_column(Enum(DriverType), default=DriverType.COMPANY)
    telegram_chat_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Broker(Base):
    __tablename__ = "brokers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    works_with_rts: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Load(Base):
    __tablename__ = "loads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    load_number: Mapped[str] = mapped_column(Text)
    broker_id: Mapped[int] = mapped_column(Integer, ForeignKey("brokers.id"))
    driver_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("drivers.id"), nullable=True)
    pu_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    del_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    pu_location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    del_location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gross_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    cut_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    added_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    final_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    payment_method: Mapped[Optional[PaymentMethod]] = mapped_column(Enum(PaymentMethod), nullable=True)
    quickpay_deduction: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    net_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    payment_status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    bol_signed: Mapped[bool] = mapped_column(Boolean, default=False)
    pod_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    approval_status: Mapped[ApprovalStatus] = mapped_column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING)
    load_status: Mapped[LoadStatus] = mapped_column(Enum(LoadStatus), default=LoadStatus.NEW, server_default="NEW")
    assigned_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    email_source_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pu_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    del_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pu_time_window: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    del_time_window: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    weight: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    consignee_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    distance_miles: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    calculated_eta: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    driver_eta: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    eta_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    broker: Mapped["Broker"] = relationship("Broker")
    driver: Mapped[Optional["Driver"]] = relationship("Driver")
    assigner: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assigned_by])
    approver: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by])


class LoadEvent(Base):
    __tablename__ = "load_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    load_id: Mapped[int] = mapped_column(Integer, ForeignKey("loads.id"))
    event_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    link: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GmailWhitelist(Base):
    __tablename__ = "gmail_whitelist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email_pattern: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
