import json
import logging
import os
import re

import anthropic
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_client: anthropic.Anthropic | None = None

_SYSTEM = """You are a data extraction assistant for a freight logistics company.
Extract load information from broker rate confirmation emails.
Return ONLY a valid JSON object with exactly these fields. Use null for any field you cannot find.

{
  "load_number": "the load/order/reference number as a string",
  "broker_name": "the broker company name (e.g. RXO, BBI, 7 STAR, CAL, ALG)",
  "gross_rate": 0.00,
  "pu_date": "YYYY-MM-DD or null",
  "del_date": "YYYY-MM-DD or null",
  "pu_location": "City, ST or null",
  "del_location": "City, ST or null",
  "payment_method": "RTS or QUICKPAY or null"
}

gross_rate must be a number (no currency symbol, no commas).
Return nothing except the JSON object. No explanation, no markdown, no code fences."""


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        if not os.getenv("ANTHROPIC_API_KEY"):
            raise ValueError("ANTHROPIC_API_KEY is not set in .env")
        _client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env automatically
    return _client


def parse_rate_confirmation(email_body: str) -> dict:
    """Send email body to Claude and return extracted load data as a dict."""
    client = _get_client()

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system=_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": (
                    "Extract load data from this rate confirmation email:\n\n"
                    + email_body[:8000]  # guard against very large emails
                ),
            }
        ],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences in case Claude wraps the JSON anyway
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude returned non-JSON: {raw[:300]}") from e
