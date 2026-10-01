import logging, os, csv, io, secrets, string, asyncio
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from jose import jwt, JWTError

from app.core.database import get_db
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.pickup import Pickup, PickupUser
from app.services.pickup_service import (
    generate_code, generate_qr_token,
    build_email_html, build_whatsapp_message, format_dt, format_dt_short,
    BRAND_NAME, LOCATION, VENUE_PHONE, FLYER_URL,
)
from app.services.email_service import send_email
from app.services.whatsapp_service import send_whatsapp

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/pickups", tags=["Pickups"])


class PickupLoginRequest(BaseModel):
    email: str
    password: str


class CreatePickupRequest(BaseModel):
    customer_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    valid_from: Optional[str] = None
    location: Optional[str] = None
    venue_phone: Optional[str] = None


class UpdatePickupRequest(BaseModel):
    customer_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    valid_from: Optional[str] = None


class SendNotificationRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None


class CreateStaffRequest(BaseModel):
    email: str
    password: str
    name: str


PICKUP_TOKEN_PREFIX = "PU-"


def _pickup_secret() -> str:
    return settings.PICKUP_JWT_SECRET or settings.SECRET_KEY


def create_pickup_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=12)
    return jwt.encode(
        {"sub": f"{PICKUP_TOKEN_PREFIX}{user_id}", "exp": expire, "role": role},
        _pickup_secret(),
        algorithm=settings.ALGORITHM,
    )


def verify_pickup_token(request: Request) -> dict:
    token = request.cookies.get("pickup_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _pickup_secret(), algorithms=[settings.ALGORITHM])
        if not payload.get("sub", "").startswith(PICKUP_TOKEN_PREFIX):
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


AuthAdmin = Depends(verify_pickup_token)


async def seed_admin_user(db: AsyncSession):
    result = await db.execute(select(PickupUser).limit(1))
    if result.scalar_one_or_none():
        return
    email = settings.PICKUP_ADMIN_EMAIL or "lajokes@accredit.vip"
    password = settings.PICKUP_ADMIN_PASSWORD or "lajokes123"
    pw_hash = hash_password(password)
    admin = PickupUser(email=email, password_hash=pw_hash, name="Super Admin", role="super_admin")
    db.add(admin)
    await db.commit()
    logger.info(f"Seeded pickup super admin: {email}")


@router.post("/auth/login")
async def pickup_login(req: PickupLoginRequest, db: AsyncSession = Depends(get_db)):
    await seed_admin_user(db)
    result = await db.execute(select(PickupUser).where(PickupUser.email == req.email.lower().strip()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_pickup_token(user.id, user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "email": user.email,
        "name": user.name,
        "role": user.role,
    }


@router.get("/me")
async def pickup_me(auth=AuthAdmin, db: AsyncSession = Depends(get_db)):
    user_id_str = auth.get("sub", "").replace(PICKUP_TOKEN_PREFIX, "")
    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(PickupUser).where(PickupUser.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
    }


@router.post("")
async def create_pickup(
    req: CreatePickupRequest,
    auth=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    code = generate_code()
    qr_token = generate_qr_token()
    now = datetime.now(timezone.utc)

    if req.valid_from:
        try:
            valid_from = datetime.fromisoformat(req.valid_from.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid valid_from format. Use ISO format.")
        expires_at = valid_from + timedelta(days=7)
    else:
        valid_from = None
        expires_at = now + timedelta(days=7)

    pickup = Pickup(
        customer_name=req.customer_name,
        email=req.email,
        phone=req.phone,
        code=code,
        qr_token=qr_token,
        status="pending",
        valid_from=valid_from,
        expires_at=expires_at,
        location=req.location or LOCATION,
        venue_phone=req.venue_phone or VENUE_PHONE,
    )
    db.add(pickup)
    await db.commit()
    await db.refresh(pickup)
    return {
        "id": pickup.id,
        "customer_name": pickup.customer_name,
        "email": pickup.email,
        "phone": pickup.phone,
        "code": pickup.code,
        "qr_token": pickup.qr_token,
        "status": pickup.status,
        "valid_from": pickup.valid_from.isoformat() if pickup.valid_from else None,
        "expires_at": pickup.expires_at.isoformat(),
        "location": pickup.location,
        "venue_phone": pickup.venue_phone,
        "created_at": pickup.created_at.isoformat(),
    }


@router.get("")
async def list_pickups(
    _=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Pickup).order_by(Pickup.created_at.desc()).limit(100)
    )
    pickups = result.scalars().all()
    return [
        {
            "id": p.id,
            "customer_name": p.customer_name,
            "email": p.email,
            "phone": p.phone,
            "code": p.code,
            "qr_token": p.qr_token,
            "status": p.status,
            "valid_from": p.valid_from.isoformat() if p.valid_from else None,
            "expires_at": p.expires_at.isoformat(),
            "picked_up_at": p.picked_up_at.isoformat() if p.picked_up_at else None,
            "location": p.location,
            "venue_phone": p.venue_phone,
            "created_at": p.created_at.isoformat(),
            "email_sent": p.email_sent,
            "whatsapp_sent": p.whatsapp_sent,
            "email_sent_at": p.email_sent_at.isoformat() if p.email_sent_at else None,
            "whatsapp_sent_at": p.whatsapp_sent_at.isoformat() if p.whatsapp_sent_at else None,
        }
        for p in pickups
    ]


@router.get("/export")
async def export_pickups_csv(
    auth=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Pickup).order_by(Pickup.created_at.desc())
    )
    pickups = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Customer Name", "Email", "Phone", "Pickup Code",
        "Status", "Valid From", "Expires At", "Picked Up At",
        "Location", "Venue Phone", "Created At",
        "Email Sent", "WhatsApp Sent",
    ])
    for p in pickups:
        writer.writerow([
            p.id,
            p.customer_name,
            p.email or "",
            p.phone or "",
            p.code,
            p.status,
            format_dt(p.valid_from) if p.valid_from else "",
            format_dt(p.expires_at) if p.expires_at else "",
            format_dt(p.picked_up_at) if p.picked_up_at else "",
            p.location or "",
            p.venue_phone or "",
            format_dt(p.created_at) if p.created_at else "",
            "Yes" if p.email_sent else "No",
            "Yes" if p.whatsapp_sent else "No",
        ])

    output.seek(0)
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=pickup_clients_{now_str}.csv"},
    )


@router.get("/{pickup_id}")
async def get_pickup(
    pickup_id: int,
    _=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pickup).where(Pickup.id == pickup_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pickup not found")
    return {
        "id": p.id,
        "customer_name": p.customer_name,
        "email": p.email,
        "phone": p.phone,
        "code": p.code,
        "qr_token": p.qr_token,
        "status": p.status,
        "valid_from": p.valid_from.isoformat() if p.valid_from else None,
        "expires_at": p.expires_at.isoformat(),
        "picked_up_at": p.picked_up_at.isoformat() if p.picked_up_at else None,
        "location": p.location,
        "venue_phone": p.venue_phone,
        "created_at": p.created_at.isoformat(),
        "email_sent": p.email_sent,
        "whatsapp_sent": p.whatsapp_sent,
    }


@router.put("/{pickup_id}")
async def update_pickup(
    pickup_id: int,
    req: UpdatePickupRequest,
    _=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pickup).where(Pickup.id == pickup_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pickup not found")
    if req.customer_name is not None:
        p.customer_name = req.customer_name
    if req.email is not None:
        p.email = req.email
    if req.phone is not None:
        p.phone = req.phone
    if req.valid_from is not None:
        try:
            p.valid_from = datetime.fromisoformat(req.valid_from.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid valid_from format")
        p.expires_at = p.valid_from + timedelta(days=7)
    await db.commit()
    await db.refresh(p)
    return {
        "id": p.id,
        "customer_name": p.customer_name,
        "email": p.email,
        "phone": p.phone,
        "code": p.code,
        "qr_token": p.qr_token,
        "status": p.status,
        "valid_from": p.valid_from.isoformat() if p.valid_from else None,
        "expires_at": p.expires_at.isoformat(),
        "picked_up_at": p.picked_up_at.isoformat() if p.picked_up_at else None,
        "location": p.location,
        "venue_phone": p.venue_phone,
        "created_at": p.created_at.isoformat(),
    }


@router.delete("/{pickup_id}")
async def delete_pickup(
    pickup_id: int,
    auth=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    if auth.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can delete")
    result = await db.execute(select(Pickup).where(Pickup.id == pickup_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pickup not found")
    await db.delete(p)
    await db.commit()
    return {"success": True, "message": f"Pickup for {p.customer_name} deleted"}


@router.get("/qr/{token}/data")
async def get_pickup_by_qr_token(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pickup).where(Pickup.qr_token == token))
    p = result.scalar_one_or_none()
    if not p:
        return {"valid": False, "reason": "not_found"}
    now = datetime.now(timezone.utc)
    if p.status == "picked_up":
        return {"valid": False, "reason": "already_picked_up", "customer_name": p.customer_name}
    if now > p.expires_at:
        return {"valid": False, "reason": "expired", "customer_name": p.customer_name, "expires_at": p.expires_at.isoformat()}
    expires_str = format_dt(p.expires_at)
    return {
        "valid": True,
        "customer_name": p.customer_name,
        "code": p.code,
        "expires_at": p.expires_at.isoformat(),
        "expires_at_formatted": expires_str,
    }


@router.post("/qr/{token}/scan")
async def scan_pickup_qr(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pickup).where(Pickup.qr_token == token))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pickup not found")
    now = datetime.now(timezone.utc)
    if p.status == "picked_up":
        raise HTTPException(status_code=400, detail="Already picked up")
    if now > p.expires_at:
        raise HTTPException(status_code=400, detail="QR code has expired")
    p.status = "picked_up"
    p.picked_up_at = now
    await db.commit()
    return {
        "success": True,
        "customer_name": p.customer_name,
        "message": f"Pickup confirmed for {p.customer_name}",
    }


@router.post("/{pickup_id}/collect")
async def mark_as_collected(
    pickup_id: int,
    _=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pickup).where(Pickup.id == pickup_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pickup not found")
    if p.status == "picked_up":
        raise HTTPException(status_code=400, detail="Already picked up")
    now = datetime.now(timezone.utc)
    p.status = "picked_up"
    p.picked_up_at = now
    await db.commit()
    return {
        "success": True,
        "customer_name": p.customer_name,
        "message": f"Pickup confirmed for {p.customer_name}",
    }


@router.post("/{pickup_id}/send-all")
async def send_pickup_all(
    pickup_id: int,
    _=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pickup).where(Pickup.id == pickup_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pickup not found")
    if not p.email and not p.phone:
        raise HTTPException(status_code=400, detail="Client has no email or phone number")

    start_dt = p.valid_from if p.valid_from else datetime.now(timezone.utc)
    end_dt = p.expires_at if p.expires_at else start_dt + timedelta(days=7)
    start_str = format_dt(start_dt)
    end_str = format_dt(end_dt)

    result_data = {"email": None, "whatsapp": None}

    if p.email:
        html = build_email_html(p.customer_name, p.code, start_str, end_str)
        logger.info(f"Sending email to {p.email} (size approx {len(html)//1024}KB)")
        ok = await asyncio.wait_for(send_email(p.email, f"Your Order is Ready for Pickup - {BRAND_NAME}", html, from_addr=f"{BRAND_NAME} <noreply@wristbandsng.com>"), timeout=15)
        logger.info(f"Email result: {'sent' if ok else 'FAILED'}")
        if ok:
            p.email_sent = True
            p.email_sent_at = datetime.now(timezone.utc)
            result_data["email"] = "sent"
        else:
            result_data["email"] = "failed"

    if p.phone:
        content_vars = {
            "1": p.customer_name,
            "2": p.location or LOCATION,
            "3": p.venue_phone or VENUE_PHONE,
            "4": p.code,
            "5": start_str,
            "6": end_str,
        }
        text = build_whatsapp_message(p.customer_name, p.code, start_str, end_str)
        flyer_ok = None
        if settings.PICKUP_FLYER_CONTENT_SID:
            flyer_vars = {"_content_sid": settings.PICKUP_FLYER_CONTENT_SID}
            flyer_ok, msg2 = await send_whatsapp(p.phone, "", "", flyer_vars)
            logger.info(f"WhatsApp flyer sent first: {'sent' if flyer_ok else 'FAILED'} (id={msg2})")
        await asyncio.sleep(10)
        ok, msg = await send_whatsapp(p.phone, text, FLYER_URL, content_vars)
        logger.info(f"WhatsApp text sent: {'sent' if ok else 'FAILED'} (id={msg})")
        p.whatsapp_sent = (ok or flyer_ok) or p.whatsapp_sent
        if ok or flyer_ok:
            p.whatsapp_sent_at = datetime.now(timezone.utc)
            result_data["whatsapp"] = "sent"

    await db.commit()
    return {"success": True, "results": result_data}


@router.post("/{pickup_id}/send-email")
async def send_pickup_email(
    pickup_id: int,
    req: SendNotificationRequest,
    _=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pickup).where(Pickup.id == pickup_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pickup not found")
    to_email = req.email or p.email
    if not to_email:
        raise HTTPException(status_code=400, detail="No email address provided")
    start_dt = p.valid_from if p.valid_from else datetime.now(timezone.utc)
    end_dt = p.expires_at if p.expires_at else start_dt + timedelta(days=7)
    start_str = format_dt(start_dt)
    end_str = format_dt(end_dt)
    html = build_email_html(p.customer_name, p.code, start_str, end_str)
    ok = await asyncio.wait_for(send_email(to_email, f"Your Order is Ready for Pickup - {BRAND_NAME}", html, from_addr=f"{BRAND_NAME} <noreply@wristbandsng.com>"), timeout=15)
    if ok:
        p.email_sent = True
        p.email_sent_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": ok, "email": to_email}


@router.post("/{pickup_id}/send-whatsapp")
async def send_pickup_whatsapp(
    pickup_id: int,
    req: SendNotificationRequest,
    _=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pickup).where(Pickup.id == pickup_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pickup not found")
    to_phone = req.phone or p.phone
    if not to_phone:
        raise HTTPException(status_code=400, detail="No phone number provided")
    start_dt = p.valid_from if p.valid_from else datetime.now(timezone.utc)
    end_dt = p.expires_at if p.expires_at else start_dt + timedelta(days=7)
    start_str = format_dt(start_dt)
    end_str = format_dt(end_dt)
    content_vars = {
        "1": p.customer_name,
        "2": p.location or LOCATION,
        "3": p.venue_phone or VENUE_PHONE,
        "4": p.code,
        "5": start_str,
        "6": end_str,
    }
    text = build_whatsapp_message(p.customer_name, p.code, start_str, end_str)
    if settings.PICKUP_FLYER_CONTENT_SID:
        flyer_vars = {"_content_sid": settings.PICKUP_FLYER_CONTENT_SID}
        await send_whatsapp(to_phone, "", "", flyer_vars)
    await asyncio.sleep(10)
    ok, msg = await send_whatsapp(to_phone, text, FLYER_URL, content_vars)
    if ok:
        p.whatsapp_sent = True
        p.whatsapp_sent_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": True, "phone": to_phone, "message_id": msg}


@router.get("/staff/list")
async def list_staff(
    auth=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    if auth.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can manage staff")
    result = await db.execute(select(PickupUser).order_by(PickupUser.created_at.desc()))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.post("/staff/create")
async def create_staff(
    req: CreateStaffRequest,
    auth=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    if auth.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can manage staff")
    existing = await db.execute(select(PickupUser).where(PickupUser.email == req.email.lower().strip()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    pw_hash = hash_password(req.password)
    staff = PickupUser(email=req.email.lower().strip(), password_hash=pw_hash, name=req.name, role="staff")
    db.add(staff)
    await db.commit()
    await db.refresh(staff)
    return {
        "id": staff.id,
        "email": staff.email,
        "name": staff.name,
        "role": staff.role,
    }


@router.delete("/staff/{staff_id}")
async def delete_staff(
    staff_id: int,
    auth=AuthAdmin,
    db: AsyncSession = Depends(get_db),
):
    if auth.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can manage staff")
    result = await db.execute(select(PickupUser).where(PickupUser.id == staff_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Staff not found")
    if user.role == "super_admin":
        raise HTTPException(status_code=400, detail="Cannot delete super admin")
    await db.delete(user)
    await db.commit()
    return {"success": True, "message": f"Staff {user.name} deleted"}
