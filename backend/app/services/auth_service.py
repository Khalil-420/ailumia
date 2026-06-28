import asyncio
import imaplib
from datetime import datetime, timedelta, timezone
from app.repositories.user_repo import user_repo
from app.repositories.session_repo import session_repo
from app.core.security import create_access_token, encrypt_password
from app.config import get_settings

settings = get_settings()


def _verify_imap(host: str, email: str, password: str) -> None:
    """Synchronous IMAP auth — must be run in a thread via run_in_executor."""
    imap = imaplib.IMAP4_SSL(host, 993)
    imap.login(email, password)
    imap.logout()


async def _is_zimbra_admin(host: str, username: str, password: str) -> bool:
    """
    Try to authenticate against the Zimbra Admin SOAP endpoint (port 7071).
    No SOAP library needed — it's just an HTTP POST with XML.
    Returns True if Zimbra accepts the credentials as admin, False otherwise.
    """
    import httpx
    url = f"https://{host}:7071/service/admin/soap"
    xml = f"""<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <AuthRequest xmlns="urn:zimbraAdmin">
      <name>{username}</name>
      <password>{password}</password>
    </AuthRequest>
  </soap:Body>
</soap:Envelope>"""
    try:
        async with httpx.AsyncClient(verify=False, timeout=5) as client:
            res = await client.post(url, content=xml,
                                    headers={"Content-Type": "application/soap+xml"})
            return "authToken" in res.text
    except Exception:
        return False


async def logout(jwt_token: str) -> None:
    await session_repo.invalidate(jwt_token)


async def login(username: str, password: str, ip_address: str | None) -> dict:
    email = f"{username}@{settings.zimbra_domain}"

    # Verify credentials via IMAP in a thread (blocking call — must not run on event loop)
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _verify_imap, settings.zimbra_host, email, password)
        zimbra_token = "imap_auth_success"
        zimbra_id = f"zimbra_{username}"
    except Exception as e:
        raise ValueError(f"Invalid credentials: {e}")

    # Detect admin role: try Zimbra admin SOAP endpoint (port 7071)
    is_admin = await _is_zimbra_admin(settings.zimbra_host, username, password)
    detected_role = "admin" if is_admin else "employee"
    
    # Check if user already exists
    user = await user_repo.find_by_zimbra_id(zimbra_id)
    
    if not user:
        user = await user_repo.find_by_email(email)
    
    if not user:
        user = await user_repo.create(
            zimbra_id=zimbra_id,
            email=email,
            username=username,
            zimbra_token=zimbra_token,
            token_expires_at=datetime.now(timezone.utc) + timedelta(days=30)
        )
        # Set detected role (create() defaults to 'employee', update if admin)
        if detected_role == "admin":
            await user_repo.set_role(user["id"], "admin")
            user = await user_repo.find_by_id(user["id"])
    else:
        await user_repo.update_token(
            user["id"],
            zimbra_token,
            datetime.now(timezone.utc) + timedelta(days=30)
        )
        # Always sync role from Zimbra on every login
        if user["role"] != detected_role:
            await user_repo.set_role(user["id"], detected_role)
            user = await user_repo.find_by_id(user["id"])
    
    jwt_exp = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    access_token = create_access_token({
        "sub":      str(user["id"]),
        "email":    email,
        "username": username,
        # password is NOT in the JWT — stored encrypted in the DB instead
    })

    await session_repo.create(
        user["id"], access_token, jwt_exp, ip_address,
        encrypted_password=encrypt_password(password),
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.jwt_expire_hours * 3600,
        "user": {
            "id": user["id"],
            "email": email,
            "username": username,
            "role": user["role"]
        }
    }
