import asyncio
import logging
import os

from dotenv import load_dotenv
from telegram import Bot

load_dotenv()

logger = logging.getLogger(__name__)

# Cache bot username at module load to avoid blocking the event loop
_bot_username: str | None = None


def _get_token() -> str:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise ValueError("Telegram bot not configured — set TELEGRAM_BOT_TOKEN in .env")
    return token


def get_bot_username() -> str | None:
    """Return cached bot username."""
    return _bot_username


def init_bot_username() -> None:
    """Call once at startup (outside the async loop) to cache the bot username."""
    global _bot_username
    try:
        token = os.getenv("TELEGRAM_BOT_TOKEN")
        if not token:
            return

        async def _get():
            async with Bot(token=token) as bot:
                me = await bot.get_me()
                return me.username

        _bot_username = asyncio.run(_get())
        logger.info(f"Telegram bot ready: @{_bot_username}")
    except Exception as e:
        logger.error(f"Could not fetch bot username: {e}")
        _bot_username = None


def send_settlement(chat_id: str, message: str) -> None:
    """Send an HTML-formatted message to a Telegram chat."""
    async def _send():
        async with Bot(token=_get_token()) as bot:
            await bot.send_message(chat_id=chat_id, text=message, parse_mode="HTML")

    asyncio.run(_send())


def send_load_notification(chat_id: str, load: dict) -> None:
    """Send a formatted load assignment notification."""
    lines = ["<b>🚛 New Load Assigned</b>"]
    lines.append(f"Load #: <code>{load.get('load_number', 'N/A')}</code>")
    lines.append(f"Broker: {load.get('broker_name', 'N/A')}")
    if load.get("pu_location"):
        lines.append(f"📍 Pickup: {load['pu_location']}")
    if load.get("del_location"):
        lines.append(f"📍 Delivery: {load['del_location']}")
    if load.get("pu_date"):
        lines.append(f"📅 PU Date: {load['pu_date']}")
    if load.get("gross_rate"):
        lines.append(f"💰 Rate: <b>${float(load['gross_rate']):,.2f}</b>")
    lines.append("\n<i>Sent via FreightDesk</i>")
    send_settlement(chat_id, "\n".join(lines))
