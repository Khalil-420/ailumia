from datetime import datetime
from app.db.singleton import get_db


class SessionRepository:
    async def create(self, user_id: int, jwt_token: str,
                     expires_at: datetime, ip_address: str | None = None,
                     encrypted_password: str | None = None):
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO sessions (user_id, jwt_token, expires_at, ip_address, encrypted_password)
                VALUES ($1, $2, $3, $4, $5)
                """,
                user_id, jwt_token, expires_at, ip_address, encrypted_password,
            )

    async def get_encrypted_password(self, jwt_token: str) -> str | None:
        """Returns the encrypted password if the session is valid, None otherwise."""
        pool = await get_db()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT encrypted_password FROM sessions
                WHERE jwt_token = $1 AND expires_at > NOW()
                """,
                jwt_token,
            )
            return row["encrypted_password"] if row else None

    async def get_encrypted_password_for_user(self, user_id: int) -> str | None:
        """Returns the encrypted password from the most recent active session for a user."""
        pool = await get_db()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT encrypted_password FROM sessions
                WHERE user_id = $1 AND expires_at > NOW()
                ORDER BY created_at DESC LIMIT 1
                """,
                user_id,
            )
            return row["encrypted_password"] if row else None

    async def invalidate(self, jwt_token: str):
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM sessions WHERE jwt_token = $1", jwt_token
            )

    async def is_valid(self, jwt_token: str) -> bool:
        pool = await get_db()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT 1 FROM sessions WHERE jwt_token = $1 AND expires_at > NOW()",
                jwt_token
            )
            return row is not None

    async def cleanup_expired(self):
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM sessions WHERE expires_at < NOW()")


session_repo = SessionRepository()
