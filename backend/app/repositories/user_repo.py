from datetime import datetime
from app.db.singleton import get_db


class UserRepository:
    async def find_by_zimbra_id(self, zimbra_id: str):
        pool = await get_db()
        async with pool.acquire() as conn:
            return await conn.fetchrow(
                "SELECT * FROM users WHERE zimbra_id = $1", zimbra_id
            )

    async def find_by_id(self, user_id: int):
        pool = await get_db()
        async with pool.acquire() as conn:
            return await conn.fetchrow(
                "SELECT * FROM users WHERE id = $1", user_id
            )

    async def find_by_email(self, email: str):
        pool = await get_db()
        async with pool.acquire() as conn:
            return await conn.fetchrow(
                "SELECT * FROM users WHERE email = $1", email
            )

    async def create(self, zimbra_id: str, email: str, username: str,
                     zimbra_token: str, token_expires_at: datetime):
        pool = await get_db()
        async with pool.acquire() as conn:
            return await conn.fetchrow(
                """
                INSERT INTO users (zimbra_id, email, username, zimbra_token, token_expires_at)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
                """,
                zimbra_id, email, username, zimbra_token, token_expires_at
            )

    async def update_token(self, user_id: int, zimbra_token: str, token_expires_at: datetime):
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE users
                SET zimbra_token = $1, token_expires_at = $2, updated_at = NOW()
                WHERE id = $3
                """,
                zimbra_token, token_expires_at, user_id
            )


    async def list_all(self):
        pool = await get_db()
        async with pool.acquire() as conn:
            return await conn.fetch(
                "SELECT id, zimbra_id, email, username, role, is_active, created_at FROM users ORDER BY created_at DESC"
            )

    async def delete_by_id(self, user_id: int):
        pool = await get_db()
        async with pool.acquire() as conn:
            # Invalidate all sessions first
            await conn.execute("DELETE FROM sessions WHERE user_id = $1", user_id)
            await conn.execute("DELETE FROM users WHERE id = $1", user_id)

    async def set_role(self, user_id: int, role: str):
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2",
                role, user_id
            )


user_repo = UserRepository()
