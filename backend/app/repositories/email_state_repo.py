from app.db.singleton import get_db


class EmailStateRepository:

    async def get_states(self, user_id: int, message_ids: list[str]) -> dict[str, dict]:
        """Return {message_id: {starred, read}} for known emails."""
        ids = [m for m in message_ids if m]
        if not ids:
            return {}
        pool = await get_db()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT message_id, starred, read FROM email_states
                WHERE user_id = $1 AND message_id = ANY($2::text[])
                """,
                user_id, ids,
            )
            return {r["message_id"]: {"starred": r["starred"], "read": r["read"]}
                    for r in rows}

    async def upsert_starred(self, user_id: int, message_id: str, starred: bool):
        if not message_id:
            return
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO email_states (user_id, message_id, starred)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, message_id)
                DO UPDATE SET starred = EXCLUDED.starred, updated_at = NOW()
                """,
                user_id, message_id, starred,
            )

    async def upsert_read(self, user_id: int, message_id: str, read: bool):
        if not message_id:
            return
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO email_states (user_id, message_id, read)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, message_id)
                DO UPDATE SET read = EXCLUDED.read, updated_at = NOW()
                """,
                user_id, message_id, read,
            )

    async def upsert_both(self, user_id: int, message_id: str,
                          starred: bool, read: bool):
        if not message_id:
            return
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO email_states (user_id, message_id, starred, read)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, message_id)
                DO UPDATE SET starred = EXCLUDED.starred,
                              read    = EXCLUDED.read,
                              updated_at = NOW()
                """,
                user_id, message_id, starred, read,
            )


    async def delete_state(self, user_id: int, message_id: str):
        if not message_id:
            return
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM email_states WHERE user_id = $1 AND message_id = $2",
                user_id, message_id,
            )


email_state_repo = EmailStateRepository()
