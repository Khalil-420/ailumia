from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.db.singleton import DatabasePool
from app.db.migrations import run_migrations
from app.routers import auth, emails, admin, conversations

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await DatabasePool.get_pool()
    await run_migrations()
    # Preload PII masking model once at startup to avoid delay on first request
    import asyncio
    loop = asyncio.get_event_loop()
    from app.services.ai_service import _get_ner
    await loop.run_in_executor(None, _get_ner)  # preload NER model at startup
    print("🚀  AILumia API ready")
    yield
    await DatabasePool.close()
    print("🛑  Shutdown complete")


app = FastAPI(
    title="AILumia API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(emails.router)
app.include_router(conversations.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
