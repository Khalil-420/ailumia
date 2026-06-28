from app.repositories.conversation_repo import conversation_repo


async def record_sent_email(user_id: int, message_id: str, subject: str = ""):
    """Record a sent email's message_id so replies to it can be detected later."""
    if not message_id:
        return
    try:
        await conversation_repo.record_sent(user_id, message_id.strip(), subject)
        print(f"[SENT-RECORD] user={user_id} message_id={message_id[:60]}", flush=True)
    except Exception as e:
        print(f"[SENT-RECORD] FAILED user={user_id}: {e}", flush=True)
