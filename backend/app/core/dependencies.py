from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_token, decrypt_password
from app.repositories.session_repo import session_repo
from app.repositories.user_repo import user_repo

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # Validate the session and retrieve the encrypted password in one query
    encrypted = await session_repo.get_encrypted_password(token)
    if encrypted is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired — please log in again",
        )

    user_id = int(payload.get("sub"))
    user = await user_repo.find_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    result = dict(user)
    result["password"] = decrypt_password(encrypted)
    return result
