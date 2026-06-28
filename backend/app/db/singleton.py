import asyncio
import asyncpg
from app.config import get_settings

settings = get_settings()


class DatabasePool:
    _instance: asyncpg.Pool | None = None
    _lock = asyncio.Lock()

    @classmethod
    async def get_pool(cls) -> asyncpg.Pool:
        if cls._instance is None:
            async with cls._lock:
                if cls._instance is None:
                    cls._instance = await asyncpg.create_pool(
                        dsn=settings.database_url,
                        min_size=2,
                        max_size=10,
                        command_timeout=30,
                    )
        return cls._instance

    @classmethod
    async def close(cls):
        if cls._instance:
            await cls._instance.close()
            cls._instance = None


async def get_db():
    return await DatabasePool.get_pool()
