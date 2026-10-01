import secrets, random, logging, asyncio
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel, EmailStr
from jose import jwt
import httpx

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.password_reset import PasswordResetToken
from app.models.guest import Guest
from app.models.event import Event
from app.services.email_service import send_email
from app.services.sms_service import send_sms
from app.services.whatsapp_service import send_whatsapp
from app.services.secure_auth import SecureAuthService
from app.services.audit import AuditService
from app.services.trial_enforcement import TrialEnforcementService
from app.schemas.security import RegisterRequest as SecureRegisterRequest, StrongPassword

logger = logging.getLogger(__name__)

VERIFICATION_EXPIRY_MINUTES = 20

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    phone: str | None = None
    verification_channel: str = "email"
    device_fingerprint: str | None = None  # Captured from device to link trial history


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class SocialLoginRequest(BaseModel):
    provider: str
    id_token: str
    email: str | None = None
    full_name: str | None = None


def generate_numeric_code(length: int = 6) -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(length))


def set_auth_cookie(response: Response, token: str):
    """SECURITY: Set authentication cookie with strict security settings"""
    max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    secure = not settings.DEBUG
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=max_age,
        path="/",
    )


@router.post("/register", response_model=TokenResponse)
async def register(
    req: SecureRegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """SECURITY: Register with strong password validation"""
    # Password already validated by Pydantic schema (SecureRegisterRequest)

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        logger.warning(f"Registration attempt with existing email: {req.email}")
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check if phone already exists
    if req.phone:
        result = await db.execute(select(User).where(User.phone == req.phone))
        if result.scalar_one_or_none():
            logger.warning(f"Registration attempt with existing phone: {req.phone}")
            raise HTTPException(status_code=400, detail="Phone number already registered")

    # Generate verification token
    channel = req.verification_channel or "email"
    is_numeric = channel in ("sms", "whatsapp")
    verification_token = generate_numeric_code() if is_numeric else secrets.token_urlsafe(32)

    # Create user with hashed password
    fingerprint_hash = None
    if req.device_fingerprint:
        fingerprint_hash = TrialEnforcementService._fingerprint_hash(req.device_fingerprint)

    user = User(
        email=req.email,
        full_name=f"{req.first_name} {req.last_name}",
        phone=req.phone,
        password_hash=hash_password(req.password),
        verification_token=verification_token,
        verification_token_expires_at=datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_EXPIRY_MINUTES),
        verification_channel=channel,
        failed_login_attempts=0,  # Initialize security counter
        trial_fingerprint_hash=fingerprint_hash,  # Link device to account for trial tracking
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Transfer trial events created with this email to the new user
    guest_result = await db.execute(
        select(Guest).where(Guest.email.ilike(req.email))
    )
    trial_guests = guest_result.scalars().all()
    for trial_guest in trial_guests:
        event_result = await db.execute(
            select(Event).where(Event.id == trial_guest.event_id, Event.status == "trial")
        )
        trial_event = event_result.scalar_one_or_none()
        if trial_event and trial_event.organizer_id != user.id:
            trial_event.organizer_id = user.id
    if trial_guests:
        await db.commit()

    # Send verification message (non-blocking: don't block registration on email delivery)
    if channel == "whatsapp" and user.phone:
        msg = f"Your Accredit.vip verification code: {verification_token}. Expires in {VERIFICATION_EXPIRY_MINUTES} minutes."
        await send_whatsapp(user.phone, msg)
    elif channel == "sms" and user.phone:
        msg = f"Your Accredit.vip verification code: {verification_token}. Expires in {VERIFICATION_EXPIRY_MINUTES} minutes."
        await send_sms(user.phone, msg)
    else:
        verify_link = f"{settings.FRONTEND_URL}/verify?token={verification_token}"
        html = f"<p>Welcome to Accredit.vip!</p><p>Click <a href='{verify_link}'>here</a> to verify your account. This link expires in {VERIFICATION_EXPIRY_MINUTES} minutes.</p>"
        asyncio.create_task(send_email(user.email, f"Verify your Accredit.vip account (expires in {VERIFICATION_EXPIRY_MINUTES} min)", html))

    # Log registration
    await AuditService.log_event(
        db=db,
        user_id=user.id,
        action="registered",
        resource_type="user",
        resource_id=user.id,
        request=request,
        description=f"User registered via {channel}",
    )

    # Create token and set secure cookie
    token = create_access_token({"sub": str(user.id)})
    set_auth_cookie(response, token)

    logger.info(f"User registered successfully: {user.email}")

    return TokenResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "last_login": None, "is_verified": user.is_verified, "verification_channel": user.verification_channel},
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """SECURITY: Login with account lockout and rate limiting"""
    try:
        # Authenticate with SecureAuthService (handles lockout, rate limiting, audit)
        user, access_token = await SecureAuthService.authenticate_user(
            db=db,
            email=req.email,
            password=req.password,
            request=request,
        )

        # Set secure authentication cookie
        set_auth_cookie(response, access_token)

        # Transfer trial events created with this email to the user on login
        guest_result = await db.execute(select(Guest).where(Guest.email.ilike(user.email)))
        trial_guests = guest_result.scalars().all()
        for trial_guest in trial_guests:
            event_result = await db.execute(
                select(Event).where(Event.id == trial_guest.event_id, Event.status == "trial")
            )
            trial_event = event_result.scalar_one_or_none()
            if trial_event and trial_event.organizer_id != user.id:
                trial_event.organizer_id = user.id
        if trial_guests:
            await db.commit()

        logger.info(f"User login successful: {user.email}")

        return TokenResponse(
            access_token=access_token,
            user={
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "last_login": str(user.last_login_at) if user.last_login_at else None,
                "is_verified": user.is_verified,
                "verification_channel": user.verification_channel,
            },
        )

    except HTTPException as e:
        logger.warning(f"Login failed for {req.email}: {e.detail}")
        raise


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SECURITY: Logout with audit logging"""
    # Log logout event
    await AuditService.log_logout(
        db=db,
        user_id=user.id,
        request=request,
    )

    # Clear authentication cookie
    response.delete_cookie(
        key="access_token",
        path="/",
        domain="accredit.vip" if not settings.DEBUG else None,
    )

    logger.info(f"User logout: {user.email}")

    return {"message": "Logged out successfully"}


GOOGLE_OPENID_CONFIG = "https://accounts.google.com/.well-known/openid-configuration"
APPLE_PUBLIC_KEYS_URL = "https://appleid.apple.com/auth/keys"


async def verify_google_token(id_token: str) -> dict:
    try:
        unverified = jwt.get_unverified_header(id_token)
        async with httpx.AsyncClient() as client:
            resp = await client.get(GOOGLE_OPENID_CONFIG)
            resp.raise_for_status()
            config = resp.json()
            keys_resp = await client.get(config["jwks_uri"])
            keys_resp.raise_for_status()
            keys_data = keys_resp.json()
        payload = jwt.decode(id_token, keys_data, audience=settings.GOOGLE_CLIENT_ID,
                             options={"verify_at_hash": False, "verify_aud": True})
        if payload.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            raise HTTPException(status_code=401, detail="Invalid Google token issuer")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Google token expired")
    except jwt.JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")


async def verify_facebook_token(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://graph.facebook.com/me",
            params={"access_token": access_token, "fields": "id,name,email"}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Facebook token")
        data = resp.json()
        if "id" not in data:
            raise HTTPException(status_code=401, detail="Invalid Facebook token")
        return {"sub": data["id"], "email": data.get("email"), "name": data.get("name")}


async def verify_apple_token(id_token: str) -> dict:
    try:
        unverified = jwt.get_unverified_header(id_token)
        async with httpx.AsyncClient() as client:
            resp = await client.get(APPLE_PUBLIC_KEYS_URL)
            resp.raise_for_status()
            keys_data = resp.json()
        payload = jwt.decode(id_token, keys_data, audience=settings.APPLE_CLIENT_ID,
                             options={"verify_at_hash": False, "verify_aud": True})
        if payload.get("iss") not in ("https://appleid.apple.com",):
            raise HTTPException(status_code=401, detail="Invalid Apple token issuer")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Apple token expired")
    except jwt.JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Apple token: {e}")


@router.post("/social", response_model=TokenResponse)
async def social_login(req: SocialLoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    if req.provider not in ("google", "facebook", "apple"):
        raise HTTPException(status_code=400, detail="Unsupported provider")

    if req.provider == "google":
        payload = await verify_google_token(req.id_token)
        provider_id = payload["sub"]
        email = req.email or payload.get("email")
        full_name = req.full_name or payload.get("name")
    elif req.provider == "facebook":
        payload = await verify_facebook_token(req.id_token)
        provider_id = payload["sub"]
        email = req.email or payload.get("email")
        full_name = req.full_name or payload.get("name")
    elif req.provider == "apple":
        payload = await verify_apple_token(req.id_token)
        provider_id = payload["sub"]
        email = req.email or payload.get("email")
        full_name = req.full_name or payload.get("name")

    if not email:
        email = f"{req.provider}_{provider_id[:16]}@social.accredit.vip"

    # Find existing user by oauth_id or email (NOT by provider alone)
    result = await db.execute(
        select(User).where(
            or_(
                User.oauth_id == provider_id,
                User.email == email,
            )
        )
    )
    user = result.scalar_one_or_none()

    if user:
        if user.oauth_id and user.oauth_id != provider_id:
            raise HTTPException(status_code=409, detail=f"Account linked to {user.oauth_provider}")
        user.oauth_provider = req.provider
        user.oauth_id = provider_id
        if full_name:
            user.full_name = full_name
        if email:
            user.email = email
        user.is_verified = True
    else:
        user = User(
            email=email,
            full_name=full_name or f"{req.provider.title()} User",
            password_hash=hash_password(secrets.token_urlsafe(16)),
            oauth_provider=req.provider,
            oauth_id=provider_id,
            is_verified=True,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    set_auth_cookie(response, token)
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "last_login": None, "is_verified": user.is_verified, "verification_channel": user.verification_channel},
    )


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role,
        "last_login": str(user.last_login_at) if user.last_login_at else None,
        "is_admin": user.role in ("admin", "super_admin"),
        "is_verified": user.is_verified,
        "verification_channel": user.verification_channel,
    }


class VerifyRequest(BaseModel):
    token: str


@router.post("/verify")
async def verify_account(req: VerifyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(
            User.verification_token == req.token,
            User.is_verified == False,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or already verified token")
    if user.verification_token_expires_at and user.verification_token_expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification token has expired. Request a new one.")

    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires_at = None
    await db.commit()
    return {"message": "Account verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Account already verified")

    channel = user.verification_channel
    is_numeric = channel in ("sms", "whatsapp")
    verification_token = generate_numeric_code() if is_numeric else secrets.token_urlsafe(32)
    user.verification_token = verification_token
    user.verification_token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_EXPIRY_MINUTES)
    await db.commit()

    if channel == "whatsapp" and user.phone:
        msg = f"Your Accredit.vip verification code: {verification_token}. Expires in {VERIFICATION_EXPIRY_MINUTES} minutes."
        await send_whatsapp(user.phone, msg)
    elif channel == "sms" and user.phone:
        msg = f"Your Accredit.vip verification code: {verification_token}. Expires in {VERIFICATION_EXPIRY_MINUTES} minutes."
        await send_sms(user.phone, msg)
    else:
        verify_link = f"{settings.FRONTEND_URL}/verify?token={verification_token}"
        html = f"<p>Click <a href='{verify_link}'>here</a> to verify your account. Expires in {VERIFICATION_EXPIRY_MINUTES} minutes.</p>"
        asyncio.create_task(send_email(user.email, f"Verify your Accredit.vip account (expires in {VERIFICATION_EXPIRY_MINUTES} min)", html))

    return {"message": f"Verification sent via {channel}", "is_numeric": is_numeric}


class ForgotPasswordRequest(BaseModel):
    email: str


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        return {"message": "If that email exists, a reset link has been sent"}

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    reset = PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at)
    db.add(reset)
    await db.commit()

    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    html = f"<p>Click <a href='{reset_link}'>here</a> to reset your password. This link expires in 1 hour.</p>"
    asyncio.create_task(send_email(user.email, "Reset your Accredit.vip password", html))

    return {"message": "If that email exists, a reset link has been sent"}


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token == req.token,
            PasswordResetToken.used == 0,
        )
    )
    reset = result.scalar_one_or_none()
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if reset.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")

    user_result = await db.execute(select(User).where(User.id == reset.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    user.password_hash = hash_password(req.new_password)
    reset.used = 1
    await db.commit()

    return {"message": "Password reset successful"}


class UpdateEmailRequest(BaseModel):
    new_email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ("super_admin",):
        raise HTTPException(status_code=403, detail="Only super admin can change passwords")
    if not verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.password_hash = hash_password(req.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


@router.put("/email")
async def update_email(
    req: UpdateEmailRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ("super_admin",):
        raise HTTPException(status_code=403, detail="Only super admin can change email")
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Password is incorrect")

    if req.new_email == user.email:
        raise HTTPException(status_code=400, detail="New email is the same as current email")

    result = await db.execute(select(User).where(User.email == req.new_email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already in use")

    user.email = req.new_email
    user.is_verified = False
    await db.commit()
    await db.refresh(user)
    return {"message": "Email updated successfully", "email": user.email}
