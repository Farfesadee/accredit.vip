# Security Integration Guide

Complete guide to integrating all security components into existing code.

## ✅ Phase 1: Configuration (COMPLETED)

- [x] Updated `app/core/config.py` with security settings
- [x] Updated `app/main.py` with security headers and CORS
- [x] Created `.env.example` template  
- [x] Updated `requirements.txt` with dependencies

## Phase 2: Database Migrations (TODO)

```bash
cd backend
alembic revision --autogenerate -m "Add login security fields to user"
alembic revision --autogenerate -m "Create audit log table"
alembic upgrade head
```

New User fields (auto-generated):
- `failed_login_attempts: int = 0`
- `locked_until: Optional[datetime] = None`
- `last_login_at: Optional[datetime] = None`
- `last_login_ip: Optional[str] = None`

## Phase 3: Update Auth Endpoints

In `backend/app/api/auth.py`, update login endpoint:

```python
from fastapi.responses import JSONResponse
from app.services.secure_auth import SecureAuthService
from app.services.audit import AuditService
from app.schemas.security import RegisterRequest
from app.core.config import settings

@router.post("/login")
async def login(
    email: str,
    password: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user, access_token = await SecureAuthService.authenticate_user(
        db=db, email=email, password=password, request=request
    )

    response = JSONResponse(
        content={
            "access_token": access_token,
            "token_type": "bearer",
            "user": {"id": user.id, "email": user.email}
        }
    )

    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        secure=not settings.DEBUG,
        httponly=True,
        samesite="strict",
    )
    return response

@router.post("/register")
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # req already validated by Pydantic
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=req.email,
        full_name=f"{req.first_name} {req.last_name}",
        password_hash=hash_password(req.password),
        phone=req.phone,
    )
    db.add(user)
    await db.commit()

    await AuditService.log_event(
        db, user.id, "registered", "user", user.id, request
    )
    
    return {"access_token": create_access_token({"sub": str(user.id)})}
```

## Phase 4: Update Webhook Endpoints

In `backend/app/api/webhooks.py`:

```python
from app.services.webhook_security import WebhookSecurityService

@router.post("/webhooks/paystack")
async def paystack_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    data = await WebhookSecurityService.verify_paystack_signature(
        request, body, settings.PAYSTACK_SECRET_KEY
    )
    # Process verified webhook...
```

## Phase 5: Update File Uploads

In `backend/app/api/uploads.py`:

```python
from app.services.file_upload_security import FileUploadSecurityService

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await FileUploadSecurityService.validate_upload(file)
    safe_filename = FileUploadSecurityService.generate_safe_filename(file.filename, user.id)
    # Save file...
```

## Phase 6: Enable Logging Filter

In `backend/app/main.py` (at app startup):

```python
from app.core.logging_config import configure_logging
configure_logging()
```

## Phase 7: Install & Test

```bash
pip install -r requirements.txt
alembic upgrade head

# Test strong password requirement
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"t@t.com","password":"SecurePass123!@#","first_name":"T","last_name":"U"}'
```

## All Security Components Created

✅ `app/core/config.py` - Config with env variables
✅ `app/main.py` - Security headers & CORS
✅ `app/models/user.py` - Login security fields
✅ `app/models/audit_log.py` - Audit log model
✅ `app/schemas/security.py` - Input validation schemas
✅ `app/services/encryption.py` - Data encryption service
✅ `app/services/secure_auth.py` - Secure auth with lockout
✅ `app/services/audit.py` - Audit logging service
✅ `app/services/file_upload_security.py` - File validation
✅ `app/services/webhook_security.py` - Webhook verification
✅ `app/core/logging_config.py` - Secure logging filter
✅ `.env.example` - Environment template
✅ `requirements.txt` - Updated dependencies

**All Phase 1-3 security components are now in place. Follow the integration steps above to wire them into your endpoints.**
