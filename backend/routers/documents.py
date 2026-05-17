import base64
import json
import os
from typing import Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Broker, User

router = APIRouter(tags=["documents"])

ALLOWED_TYPES = {
    "application/pdf": "application/pdf",
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/png": "image/png",
    "image/webp": "image/webp",
}

_EXTRACT_PROMPT = """Extract the following fields from this rate confirmation / load confirmation document and return ONLY valid JSON with no markdown, no explanation, no extra text:
{
  "load_number": "string or null",
  "broker_name": "string or null",
  "gross_rate": number or null,
  "pu_location": "City, ST format or null",
  "del_location": "City, ST format or null",
  "pu_date": "YYYY-MM-DD or null",
  "del_date": "YYYY-MM-DD or null",
  "payment_method": "RTS or QUICKPAY or null",
  "pu_address": "full street address of pickup including street number, city, state, zip or null",
  "del_address": "full street address of delivery including street number, city, state, zip or null",
  "pu_time_window": "pickup time window as written on the document, e.g. 'FCFS till 3 PM' or '07:00-15:00' or null",
  "del_time_window": "delivery time window as written on the document or null",
  "reference_number": "any reference number, PO number, or order number on the document or null",
  "weight": "freight weight as written, e.g. '5920 lbs' or '12000 LBS' or null",
  "consignee_name": "name of the delivery contact, company, or consignee at the destination or null"
}"""


@router.post("/parse")
async def parse_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content_type = (file.content_type or "").split(";")[0].strip()
    media_type = ALLOWED_TYPES.get(content_type)
    if not media_type:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{content_type}'. Allowed: PDF, JPG, PNG, WEBP.",
        )

    data = await file.read()
    b64 = base64.standard_b64encode(data).decode("utf-8")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    client = anthropic.Anthropic(api_key=api_key)

    if media_type == "application/pdf":
        content = [
            {
                "type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
            },
            {"type": "text", "text": _EXTRACT_PROMPT},
        ]
    else:
        content = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": b64},
            },
            {"type": "text", "text": _EXTRACT_PROMPT},
        ]

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": content}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown code fences if model wraps the JSON
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="AI returned non-JSON response — try a clearer document scan.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=500, detail=f"AI API error: {e}")

    broker_id = None
    all_brokers = db.query(Broker).all()

    def _fuzzy_match(name: str) -> Optional[int]:
        if not name:
            return None
        needle = name.lower().strip()
        for broker in all_brokers:
            hay = broker.name.lower().strip()
            if hay == needle or needle in hay or hay in needle:
                return broker.id
        return None

    broker_id = _fuzzy_match(parsed.get("broker_name"))
    if broker_id is None:
        broker_id = _fuzzy_match(parsed.get("consignee_name"))

    parsed["broker_id"] = broker_id

    return parsed
