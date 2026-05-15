import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from models import User, UserRole
from telegram_bot import send_settlement

router = APIRouter(tags=["telegram"])


class TestMessageRequest(BaseModel):
    chat_id: str


@router.get("/telegram/status")
def telegram_status(current_user: User = Depends(get_current_user)):
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        return {"configured": False, "bot_username": None}
    return {"configured": True, "bot_username": "freightdesk_uz_bot"}


@router.post("/telegram/test")
def telegram_test(
    payload: TestMessageRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a test message to verify a chat ID. HEAD_ACCOUNTANT only."""
    if current_user.role != UserRole.HEAD_ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Only HEAD_ACCOUNTANT can send test messages")

    if not os.getenv("TELEGRAM_BOT_TOKEN"):
        raise HTTPException(
            status_code=400,
            detail="Telegram bot not configured — set TELEGRAM_BOT_TOKEN in .env",
        )

    try:
        send_settlement(
            payload.chat_id,
            "✅ <b>FreightDesk</b> — test message received! Your bot is working correctly.",
        )
        return {"sent": True, "chat_id": payload.chat_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send: {str(e)}")
