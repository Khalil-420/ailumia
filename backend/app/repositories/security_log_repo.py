from app.db.singleton import get_db


class SecurityLogRepository:
    async def log(self, user_id: int, alert_type: str,
                  zimbra_email_id: str | None = None, details: str | None = None):
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO security_logs (user_id, zimbra_email_id, alert_type, details)
                VALUES ($1, $2, $3, $4)
                """,
                user_id, zimbra_email_id, alert_type, details,
            )

    async def get_recent(self, user_id: int, limit: int = 20):
        pool = await get_db()
        async with pool.acquire() as conn:
            return await conn.fetch(
                """
                SELECT * FROM security_logs
                WHERE user_id = $1
                ORDER BY created_at DESC LIMIT $2
                """,
                user_id, limit,
            )


security_log_repo = SecurityLogRepository()
