import enum
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, Text,
    Numeric, ForeignKey, Enum, func
)
from sqlalchemy.orm import relationship
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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.ACCOUNTANT)
    telegram_chat_id = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    driver_type = Column(Enum(DriverType), nullable=False, default=DriverType.COMPANY)
    telegram_chat_id = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Broker(Base):
    __tablename__ = "brokers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    full_name = Column(String(255), nullable=True)
    works_with_rts = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)


class Load(Base):
    __tablename__ = "loads"

    id = Column(Integer, primary_key=True, index=True)
    load_number = Column(Text, nullable=False)
    broker_id = Column(Integer, ForeignKey("brokers.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    pu_date = Column(Date, nullable=True)
    del_date = Column(Date, nullable=True)
    pu_location = Column(Text, nullable=True)
    del_location = Column(Text, nullable=True)
    gross_rate = Column(Numeric(10, 2), nullable=False, default=0)
    cut_rate = Column(Numeric(10, 2), nullable=False, default=0)
    added_rate = Column(Numeric(10, 2), nullable=False, default=0)
    final_rate = Column(Numeric(10, 2), nullable=False, default=0)
    payment_method = Column(Enum(PaymentMethod), nullable=True)
    quickpay_deduction = Column(Numeric(10, 2), nullable=False, default=0)
    net_rate = Column(Numeric(10, 2), nullable=False, default=0)
    payment_status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    bol_signed = Column(Boolean, default=False)
    pod_submitted = Column(Boolean, default=False)
    approval_status = Column(Enum(ApprovalStatus), nullable=False, default=ApprovalStatus.PENDING)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    email_source_id = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    broker = relationship("Broker")
    driver = relationship("Driver")
    assigner = relationship("User", foreign_keys=[assigned_by])
    approver = relationship("User", foreign_keys=[approved_by])


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    link = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
