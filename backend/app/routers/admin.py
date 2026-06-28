from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.core.dependencies import get_current_user
from app.core.security import decrypt_password
from app.repositories.user_repo import user_repo
from app.repositories.activity_log_repo import activity_log_repo
from app.repositories.session_repo import session_repo
from app.zimbra.client import zimbra_client

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


class SetRoleRequest(BaseModel):
    role: str  # "employee" or "admin"


@router.get("/employees")
async def list_employees(current_user: dict = Depends(require_admin)):
    rows = await user_repo.list_all()
    return {"employees": [dict(r) for r in rows]}


@router.delete("/employees/{user_id}")
async def delete_employee(
    user_id: int,
    current_user: dict = Depends(require_admin)
):
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    target = await user_repo.find_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found")
    await user_repo.delete_by_id(user_id)
    return {"status": "deleted", "user_id": user_id}


@router.get("/employees/{user_id}/logs")
async def get_employee_logs(
    user_id: int,
    limit: int = Query(200, le=500),
    current_user: dict = Depends(require_admin)
):
    target = await user_repo.find_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found")
    logs = await activity_log_repo.get_logs(user_id, limit)
    return {"employee": dict(target), "logs": logs}


@router.get("/employees/{user_id}/email/{email_id}")
async def get_employee_email(
    user_id: int,
    email_id: str,
    folder: str = Query("INBOX"),
    message_id: str = Query(None),
    current_user: dict = Depends(require_admin)
):
    target = await user_repo.find_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found")
    encrypted = await session_repo.get_encrypted_password_for_user(user_id)
    if not encrypted:
        raise HTTPException(status_code=409, detail="Employee has no active session — they must be logged in")
    password = decrypt_password(encrypted)
    try:
        if message_id:
            # Stable lookup via RFC 2822 Message-ID — works even if IMAP seq nums shifted
            email = await zimbra_client.get_email_by_message_id(
                email=target["email"], password=password,
                message_id=message_id, folder=folder
            )
        else:
            email = await zimbra_client.get_email_detail(
                email=target["email"], password=password,
                email_id=email_id, folder=folder
            )
        return {"email": email}
    except Exception:
        raise HTTPException(status_code=404, detail="Email not found or no longer accessible")


@router.patch("/employees/{user_id}/role")
async def set_employee_role(
    user_id: int,
    payload: SetRoleRequest,
    current_user: dict = Depends(require_admin)
):
    if payload.role not in ("employee", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'employee' or 'admin'")
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    target = await user_repo.find_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found")
    await user_repo.set_role(user_id, payload.role)
    return {"status": "updated", "user_id": user_id, "role": payload.role}
