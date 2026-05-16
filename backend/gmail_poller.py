import base64
import logging
import re
import threading
import time
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from database import SessionLocal
from email_parser import parse_rate_confirmation
from gmail_oauth import get_gmail_service
from models import ApprovalStatus, Broker, GmailWhitelist, Load, PaymentMethod

logger = logging.getLogger(__name__)

_last_poll_time: datetime | None = None


def _decode_body(payload: dict) -> str:
    mime = payload.get("mimeType", "")

    if mime == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")

    for part in payload.get("parts", []):
        text = _decode_body(part)
        if text.strip():
            return text

    if mime == "text/html":
        data = payload.get("body", {}).get("data", "")
        if data:
            html = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
            return re.sub(r"<[^>]+>", " ", html)

    return ""


def _parse_date(s) -> date | None:
    if not s:
        return None
    try:
        return date.fromisoformat(str(s))
    except (ValueError, TypeError):
        return None


def _fuzzy_broker(name: str | None, db: Session) -> Broker | None:
    if not name:
        return None
    brokers = db.query(Broker).filter(Broker.is_active == True).all()
    needle = name.upper().strip()
    for b in brokers:
        if b.name.upper() == needle:
            return b
    for b in brokers:
        if b.name.upper() in needle or needle in b.name.upper():
            return b
    return None


def _sender_allowed(sender: str, db: Session) -> bool:
    """Return True if sender matches the whitelist (or whitelist is empty)."""
    entries = db.query(GmailWhitelist).all()
    if not entries:
        return True

    sender_lower = sender.lower().strip()
    for entry in entries:
        pattern = entry.email_pattern.lower().strip()
        if pattern.startswith("@"):
            # Domain pattern: @bbi.com matches any sender @bbi.com
            if sender_lower.endswith(pattern):
                return True
        else:
            if sender_lower == pattern:
                return True
    return False


def _get_sender(msg: dict) -> str:
    headers = msg.get("payload", {}).get("headers", [])
    for h in headers:
        if h.get("name", "").lower() == "from":
            raw = h.get("value", "")
            # Extract address from "Name <addr>" format
            m = re.search(r"<([^>]+)>", raw)
            return m.group(1) if m else raw
    return ""


def poll_gmail(db: Session) -> dict:
    global _last_poll_time

    service = get_gmail_service()
    if not service:
        logger.info("Gmail not connected — skipping poll")
        return {"skipped": True, "reason": "Gmail not connected"}

    after_ts = int((datetime.now(timezone.utc) - timedelta(hours=24)).timestamp())
    query = f"is:unread after:{after_ts}"

    try:
        response = service.users().messages().list(
            userId="me", q=query, maxResults=50
        ).execute()
    except Exception as e:
        logger.error(f"Gmail list failed: {e}")
        return {"error": str(e)}

    messages = response.get("messages", [])
    created = skipped = errors = 0

    for ref in messages:
        msg_id = ref["id"]

        if db.query(Load).filter(Load.email_source_id == msg_id).first():
            skipped += 1
            continue

        try:
            msg = service.users().messages().get(
                userId="me", id=msg_id, format="full"
            ).execute()

            sender = _get_sender(msg)
            if not _sender_allowed(sender, db):
                logger.info(f"Skipping email {msg_id} from {sender} — not in whitelist")
                skipped += 1
                continue

            body = _decode_body(msg.get("payload", {}))
            if not body.strip():
                skipped += 1
                continue

            parsed = parse_rate_confirmation(body)

            broker = _fuzzy_broker(parsed.get("broker_name"), db)
            if not broker:
                logger.warning(
                    f"No broker match for '{parsed.get('broker_name')}' (email {msg_id})"
                )
                skipped += 1
                continue

            gross = float(parsed.get("gross_rate") or 0)

            pm = None
            raw_pm = (parsed.get("payment_method") or "").upper().strip()
            if raw_pm in ("RTS", "QUICKPAY"):
                try:
                    pm = PaymentMethod(raw_pm)
                except ValueError:
                    pass

            load = Load(
                load_number=parsed.get("load_number") or f"EMAIL-{msg_id[:8]}",
                broker_id=broker.id,
                pu_date=_parse_date(parsed.get("pu_date")),
                del_date=_parse_date(parsed.get("del_date")),
                pu_location=parsed.get("pu_location"),
                del_location=parsed.get("del_location"),
                gross_rate=gross,
                cut_rate=0,
                added_rate=0,
                final_rate=gross,
                quickpay_deduction=0,
                net_rate=gross,
                payment_method=pm,
                approval_status=ApprovalStatus.PENDING,
                email_source_id=msg_id,
            )
            db.add(load)
            db.commit()

            service.users().messages().modify(
                userId="me",
                id=msg_id,
                body={"removeLabelIds": ["UNREAD"]},
            ).execute()

            created += 1
            logger.info(f"Created load from email {msg_id}: {load.load_number}")

        except Exception as e:
            logger.error(f"Error processing email {msg_id}: {e}")
            db.rollback()
            errors += 1

    _last_poll_time = datetime.now(timezone.utc)
    return {"created": created, "skipped": skipped, "errors": errors}


def get_last_poll_time() -> datetime | None:
    return _last_poll_time


def start_polling(app):
    def _loop():
        time.sleep(30)
        while True:
            db = SessionLocal()
            try:
                result = poll_gmail(db)
                logger.info(f"Poll result: {result}")
            except Exception as e:
                logger.error(f"Poller loop error: {e}")
            finally:
                db.close()
            time.sleep(15 * 60)

    t = threading.Thread(target=_loop, daemon=True, name="gmail-poller")
    t.start()
    logger.info("Gmail background poller started")
