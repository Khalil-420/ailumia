from app.db.singleton import get_db


class EmailSummaryRepository:
    async def get_summaries(self, user_id: int, message_ids: list[str]) -> dict:
        if not message_ids:
            return {}
        pool = await get_db()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT message_id, title, brief, category
                FROM email_summaries
                WHERE user_id = $1 AND message_id = ANY($2)
                """,
                user_id, message_ids,
            )
        return {
            row["message_id"]: {
                "title":    row["title"],
                "brief":    row["brief"],
                "category": row["category"],
            }
            for row in rows
        }

    async def upsert(self, user_id: int, message_id: str, data: dict):
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO email_summaries (user_id, message_id, title, brief, category)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (user_id, message_id) DO UPDATE
                SET title = EXCLUDED.title,
                    brief = EXCLUDED.brief,
                    category = EXCLUDED.category
                """,
                user_id, message_id,
                data.get("title"), data.get("brief"), data.get("category"),
            )


email_summary_repo = EmailSummaryRepository()
