from app.db.singleton import get_db


class EmailTagRepository:
    async def get_tags_for_emails(self, user_id: int,
                                   zimbra_ids: list[str]) -> dict[str, str]:
        if not zimbra_ids:
            return {}
        pool = await get_db()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT zimbra_email_id, tag FROM email_tags
                WHERE user_id = $1 AND zimbra_email_id = ANY($2::text[])
                """,
                user_id, zimbra_ids,
            )
            return {r["zimbra_email_id"]: r["tag"] for r in rows}

    async def upsert(self, user_id: int, zimbra_email_id: str,
                     tag: str, auto_detected: bool = True):
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO email_tags (user_id, zimbra_email_id, tag, auto_detected)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, zimbra_email_id)
                DO UPDATE SET tag = EXCLUDED.tag, auto_detected = EXCLUDED.auto_detected
                """,
                user_id, zimbra_email_id, tag, auto_detected
            )


email_tag_repo = EmailTagRepository()
