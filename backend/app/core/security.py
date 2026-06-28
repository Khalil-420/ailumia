import base64
import hashlib
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from cryptography.fernet import Fernet
from app.config import get_settings

settings = get_settings()


def _fernet() -> Fernet:
    """Derive a stable Fernet key from the JWT secret — no extra env var needed."""
    raw_key = hashlib.sha256(settings.jwt_secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(raw_key))


def encrypt_password(password: str) -> str:
    return _fernet().encrypt(password.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    return _fernet().decrypt(encrypted.encode()).decode()


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    payload["iat"] = datetime.now(timezone.utc)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        raise ValueError("Invalid or expired token")
