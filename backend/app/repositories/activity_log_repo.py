from app.db.singleton import get_db


class ActivityLogRepository:
    async def log(self, user_id: int, action: str, email_id: str = None,
                  subject: str = None, folder: str = None, message_id: str = None):
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO employee_activity_logs
                    (user_id, action, email_id, subject, folder, message_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                user_id, action, email_id, subject, folder, message_id or None
            )

    async def get_logs(self, user_id: int, limit: int = 200):
        pool = await get_db()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, action, email_id, message_id, subject, folder, created_at
                FROM employee_activity_logs
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                user_id, limit
            )
            return [dict(r) for r in rows]


activity_log_repo = ActivityLogRepository()
