from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import GmailWhitelist, User, UserRole
from schemas import GmailWhitelistCreate, GmailWhitelistResponse

router = APIRouter(tags=["gmail"])


@router.get("/whitelist", response_model=list[GmailWhitelistResponse])
def list_whitelist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(GmailWhitelist).order_by(GmailWhitelist.created_at.asc()).all()


@router.post("/whitelist", response_model=GmailWhitelistResponse, status_code=201)
def add_whitelist_entry(
    payload: GmailWhitelistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.HEAD_ACCOUNTANT:
        raise HTTPException(status_code=403, detail="HEAD_ACCOUNTANT role required")

    pattern = payload.email_pattern.strip().lower()
    if not pattern:
        raise HTTPException(status_code=400, detail="email_pattern cannot be empty")

    if db.query(GmailWhitelist).filter(GmailWhitelist.email_pattern == pattern).first():
        raise HTTPException(status_code=400, detail="Pattern already exists")

    entry = GmailWhitelist(email_pattern=pattern, created_by=current_user.id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/whitelist/{entry_id}", status_code=204)
def delete_whitelist_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.HEAD_ACCOUNTANT:
        raise HTTPException(status_code=403, detail="HEAD_ACCOUNTANT role required")

    entry = db.query(GmailWhitelist).filter(GmailWhitelist.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Whitelist entry not found")

    db.delete(entry)
    db.commit()
