from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from gmail_oauth import CREDENTIALS_PATH, get_connected_email, get_gmail_service, run_oauth_flow
from gmail_poller import get_last_poll_time, poll_gmail
from models import User, UserRole

router = APIRouter(tags=["gmail"])


@router.get("/gmail/status")
def gmail_status(current_user: User = Depends(get_current_user)):
    """Return Gmail connection state and last poll time."""
    service = get_gmail_service()
    if not service:
        return {"connected": False, "email": None, "last_poll": None}

    email = get_connected_email()
    last_poll = get_last_poll_time()
    return {
        "connected": email is not None,
        "email": email,
        "last_poll": last_poll.isoformat() if last_poll else None,
    }


@router.post("/gmail/connect")
def gmail_connect(current_user: User = Depends(get_current_user)):
    """Run the OAuth2 flow to connect Gmail. HEAD_ACCOUNTANT only.

    This opens a browser window on the server machine and blocks until
    the user completes Google authorization (typically 10-30 seconds).
    """
    if current_user.role != UserRole.HEAD_ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Only HEAD_ACCOUNTANT can connect Gmail")

    if not CREDENTIALS_PATH.exists():
        raise HTTPException(
            status_code=400,
            detail=(
                "credentials.json not found in backend/ folder. "
                "Download it from Google Cloud Console "
                "(APIs & Services → Credentials → OAuth 2.0 Client IDs → Desktop app) "
                "and save it as backend/credentials.json"
            ),
        )

    try:
        result = run_oauth_flow()
        return {"connected": True, "email": result["email"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth flow failed: {str(e)}")


@router.post("/gmail/poll")
def gmail_poll(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger a Gmail poll. HEAD_ACCOUNTANT only."""
    if current_user.role != UserRole.HEAD_ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Only HEAD_ACCOUNTANT can trigger a poll")

    result = poll_gmail(db)
    return result
