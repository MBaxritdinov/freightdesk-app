import logging
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

# gmail.modify is required to mark emails as read (superset of gmail.readonly)
SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]

BASE_DIR = Path(__file__).parent
TOKEN_PATH = BASE_DIR / "gmail_token.json"
CREDENTIALS_PATH = BASE_DIR / "credentials.json"


def get_gmail_service():
    """Return authenticated Gmail API service, or None if not connected/valid."""
    if not TOKEN_PATH.exists():
        return None

    try:
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    except Exception:
        return None

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                TOKEN_PATH.write_text(creds.to_json())
            except Exception:
                # Token is invalid and can't be refreshed — remove it
                TOKEN_PATH.unlink(missing_ok=True)
                return None
        else:
            return None

    try:
        return build("gmail", "v1", credentials=creds)
    except Exception as e:
        logger.error(f"Failed to build Gmail service: {e}")
        return None


def run_oauth_flow(credentials_path: str = None) -> dict:
    """Run OAuth2 local server flow, save token, return {"email": ..., "success": True}."""
    cred_path = Path(credentials_path) if credentials_path else CREDENTIALS_PATH

    if not cred_path.exists():
        raise FileNotFoundError(
            f"credentials.json not found at {cred_path}. "
            "Download it from Google Cloud Console "
            "(APIs & Services → Credentials → OAuth 2.0 Client IDs → Desktop app) "
            "and save it as backend/credentials.json"
        )

    flow = InstalledAppFlow.from_client_secrets_file(str(cred_path), SCOPES)
    # port=0 picks an available port automatically
    creds = flow.run_local_server(port=0)

    TOKEN_PATH.write_text(creds.to_json())

    service = build("gmail", "v1", credentials=creds)
    profile = service.users().getProfile(userId="me").execute()
    return {"success": True, "email": profile.get("emailAddress")}


def get_connected_email() -> str | None:
    """Return the connected Gmail address, or None if not connected."""
    service = get_gmail_service()
    if not service:
        return None
    try:
        profile = service.users().getProfile(userId="me").execute()
        return profile.get("emailAddress")
    except Exception:
        return None
