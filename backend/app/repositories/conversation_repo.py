from app.db.singleton import get_db


class ConversationRepository:
    async def record_sent(self, user_id: int, message_id: str, subject: str = ""):
        """Save a sent email's message_id so we can detect future replies to it."""
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO email_threads
                    (user_id, message_id, thread_root, is_sent, email_date, subject)
                VALUES ($1, $2, $2, TRUE, NOW(), $3)
                ON CONFLICT (user_id, message_id) DO NOTHING
            """, user_id, message_id, subject or "")

    async def record_received(self, user_id: int, message_id: str, in_reply_to: str,
                              email_date, subject: str = ""):
        """Record a received reply email for count tracking."""
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO email_threads
                    (user_id, message_id, thread_root, is_sent, email_date, subject)
                VALUES ($1, $2, $3, FALSE, $4, $5)
                ON CONFLICT (user_id, message_id) DO NOTHING
            """, user_id, message_id, in_reply_to, email_date, subject or "")

    async def get_important_count(self, user_id: int) -> int:
        pool = await get_db()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT COUNT(*) AS cnt
                FROM email_threads recv
                WHERE recv.user_id = $1
                  AND recv.is_sent = FALSE
                  AND recv.thread_root IN (
                      SELECT message_id FROM email_threads
                      WHERE user_id = $1 AND is_sent = TRUE
                  )
                  AND recv.message_id NOT IN (
                      SELECT message_id FROM email_states
                      WHERE user_id = $1 AND read = TRUE
                  )
            """, user_id)
            return row["cnt"] if row else 0

    async def get_important_threads(self, user_id: int, limit: int = 10) -> list:
        """Return inbox emails that are replies to something the user sent, newest first."""
        pool = await get_db()
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT recv.message_id, recv.subject, recv.email_date, recv.thread_root
                FROM email_threads recv
                WHERE recv.user_id = $1
                  AND recv.is_sent = FALSE
                  AND recv.thread_root IN (
                      SELECT message_id FROM email_threads
                      WHERE user_id = $1 AND is_sent = TRUE
                  )
                ORDER BY recv.email_date DESC
                LIMIT $2
            """, user_id, limit)
            return [dict(r) for r in rows]

    async def check_are_replies(self, user_id: int, candidates: list) -> set:
        """
        Given a list of in_reply_to values from INBOX emails,
        return the subset that match a message_id the user actually sent.
        """
        if not candidates:
            return set()
        pool = await get_db()
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT message_id FROM email_threads
                WHERE user_id = $1
                  AND is_sent = TRUE
                  AND message_id = ANY($2)
            """, user_id, candidates)
            matched = {r["message_id"] for r in rows}
            print(
                f"[NOTIFY] user={user_id} inbox_reply_candidates={len(candidates)} "
                f"matched_sent={len(matched)}",
                flush=True
            )
            return matched


conversation_repo = ConversationRepository()
