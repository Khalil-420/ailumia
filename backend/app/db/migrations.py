from app.db.singleton import get_db


async def run_migrations():
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id               SERIAL PRIMARY KEY,
                zimbra_id        TEXT UNIQUE NOT NULL,
                email            TEXT UNIQUE NOT NULL,
                username         TEXT NOT NULL,
                role             TEXT NOT NULL DEFAULT 'employee'
                                     CHECK (role IN ('employee', 'admin')),
                zimbra_token     TEXT,
                token_expires_at TIMESTAMPTZ,
                is_active        BOOLEAN DEFAULT TRUE,
                created_at       TIMESTAMPTZ DEFAULT NOW(),
                updated_at       TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
                jwt_token   TEXT NOT NULL,
                ip_address  TEXT,
                expires_at  TIMESTAMPTZ NOT NULL,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS email_tags (
                id              SERIAL PRIMARY KEY,
                user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
                zimbra_email_id TEXT NOT NULL,
                tag             TEXT NOT NULL,
                auto_detected   BOOLEAN DEFAULT TRUE,
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, zimbra_email_id)
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS email_states (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
                message_id  TEXT NOT NULL,
                starred     BOOLEAN NOT NULL DEFAULT FALSE,
                read        BOOLEAN NOT NULL DEFAULT FALSE,
                updated_at  TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, message_id)
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS security_logs (
                id              SERIAL PRIMARY KEY,
                user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
                zimbra_email_id TEXT,
                alert_type      TEXT NOT NULL,
                details         TEXT,
                created_at      TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS email_summaries (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
                message_id  TEXT NOT NULL,
                title       TEXT,
                brief       TEXT,
                category    TEXT,
                created_at  TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, message_id)
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS employee_activity_logs (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
                action     TEXT NOT NULL,
                email_id   TEXT,
                subject    TEXT,
                folder     TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
            )
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_activity_logs_user
            ON employee_activity_logs(user_id, created_at DESC)
        """)

        # Add message_id column to activity logs for stable IMAP lookup
        await conn.execute("""
            ALTER TABLE employee_activity_logs
            ADD COLUMN IF NOT EXISTS message_id TEXT
        """)

        # Add encrypted_password to sessions if it doesn't exist yet
        await conn.execute("""
            ALTER TABLE sessions
            ADD COLUMN IF NOT EXISTS encrypted_password TEXT
        """)

        # Email thread tracking for important conversation detection
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS email_threads (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
                message_id  TEXT NOT NULL,
                thread_root TEXT NOT NULL,
                is_sent     BOOLEAN NOT NULL,
                email_date  TIMESTAMPTZ NOT NULL,
                subject     TEXT,
                UNIQUE(user_id, message_id)
            )
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_email_threads_user_root
            ON email_threads(user_id, thread_root)
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_email_threads_user_date
            ON email_threads(user_id, email_date DESC)
        """)

        print("✅ Migrations complete")
