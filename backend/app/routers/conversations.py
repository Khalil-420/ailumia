from fastapi import APIRouter, Depends, Query
from app.core.dependencies import get_current_user
from app.repositories.conversation_repo import conversation_repo

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("/important-count")
async def get_important_count(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    count = await conversation_repo.get_important_count(user_id)
    return {"count": count}


@router.get("/important")
async def get_important_threads(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    threads = await conversation_repo.get_important_threads(user_id, limit)
    return {"threads": threads}
