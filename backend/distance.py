import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_ORS_BASE = "https://api.openrouteservice.org"


def _geocode(text: str, api_key: str) -> Optional[tuple]:
    """Returns (longitude, latitude) or None."""
    try:
        resp = requests.get(
            f"{_ORS_BASE}/geocode/search",
            params={"api_key": api_key, "text": text, "size": 1},
            timeout=6,
        )
        resp.raise_for_status()
        features = resp.json().get("features", [])
        if not features:
            logger.warning(f"ORS geocode returned no results for: {text!r}")
            return None
        coords = features[0]["geometry"]["coordinates"]  # [lon, lat]
        return (coords[0], coords[1])
    except Exception as exc:
        logger.warning(f"ORS geocode failed for {text!r}: {exc}")
        return None


def calculate_distance_and_eta(pu_location: str, del_location: str) -> Optional[dict]:
    """
    Returns {"distance_miles": float, "duration_hours": float, "calculated_eta": datetime}
    or None if ORS is unavailable / API key is missing.
    Never raises — failures are logged and None is returned.
    """
    api_key = os.getenv("ORS_API_KEY")
    if not api_key:
        logger.info("ORS_API_KEY not set — skipping distance calculation")
        return None

    pu_coords = _geocode(pu_location, api_key)
    del_coords = _geocode(del_location, api_key)

    if not pu_coords or not del_coords:
        return None

    try:
        resp = requests.post(
            f"{_ORS_BASE}/v2/directions/driving-car",
            json={"coordinates": [list(pu_coords), list(del_coords)]},
            headers={
                "Authorization": api_key,
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        resp.raise_for_status()
        summary = resp.json()["routes"][0]["summary"]

        distance_miles = round(summary["distance"] / 1609.344, 1)
        duration_hours = summary["duration"] / 3600
        calculated_eta = datetime.now(timezone.utc) + timedelta(hours=duration_hours)

        return {
            "distance_miles": distance_miles,
            "duration_hours": duration_hours,
            "calculated_eta": calculated_eta,
        }
    except Exception as exc:
        logger.warning(f"ORS directions failed ({pu_location!r} → {del_location!r}): {exc}")
        return None
