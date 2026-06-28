from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.services import auth_service
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginRequest, request: Request):
    try:
        return await auth_service.login(
            username=body.username.strip(),
            password=body.password,
            ip_address=request.client.host if request.client else None,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user.get("id"),
        "email": current_user.get("email"),
        "username": current_user.get("username"),
        "role": current_user.get("role")
    }


@router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    if credentials:
        await auth_service.logout(credentials.credentials)
    return {"status": "ok"}
