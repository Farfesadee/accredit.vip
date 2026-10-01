from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import datetime, timezone, timedelta
import csv
import io
import json
import secrets

from app.core.database import get_db
from app.core.security import get_current_user, verify_password
from app.core.audit import log_action
from app.models.user import User
from app.models.audience import AudienceProfile, AudienceExportLog
from app.services.audience import sync_all_audience

router = APIRouter()

AUDIENCE_SESSION_PREFIX = "audience_auth_"
AUDIENCE_SESSION_TTL = timedelta(minutes=15)


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_super_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


async def require_audience_access(
    request: Request,
    admin: User = Depends(require_super_admin),
) -> User:
    token = request.headers.get("X-Audience-Auth")
    if not token:
        raise HTTPException(status_code=401, detail="Audience re-authentication required")
    stored = request.app.state.__dict__.get(AUDIENCE_SESSION_PREFIX + str(admin.id))
    if not stored or stored["token"] != token or datetime.now(timezone.utc) > stored["expires"]:
        raise HTTPException(status_code=401, detail="Audience session expired or invalid")
    return admin


@router.post("/admin/audience/verify-password")
async def audience_verify_password(
    request: Request,
    password: str = Query(...),
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(password, admin.password_hash):
        await log_action(db, admin.id, "audience_auth_failed", "audience", description="Failed audience password verification")
        raise HTTPException(status_code=403, detail="Invalid password")
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + AUDIENCE_SESSION_TTL
    request.app.state.__dict__[AUDIENCE_SESSION_PREFIX + str(admin.id)] = {
        "token": token,
        "expires": expires,
    }
    await log_action(db, admin.id, "audience_auth_granted", "audience", description="Audience access granted")
    return {"token": token, "expires_at": expires.isoformat()}


@router.post("/admin/audience/sync")
async def audience_sync(
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    await sync_all_audience(db)
    count_q = select(func.count(AudienceProfile.id))
    total = await db.scalar(count_q) or 0
    await log_action(db, admin.id, "audience_sync", "audience", description=f"Audience synced: {total} profiles")
    return {"message": "Audience synced", "total_profiles": total}


@router.get("/admin/audience/stats")
async def audience_stats(
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    total = await db.scalar(select(func.count(AudienceProfile.id))) or 0
    hvp = await db.scalar(select(func.count(AudienceProfile.id)).where(AudienceProfile.is_hvp == True)) or 0
    source_r = await db.execute(
        select(AudienceProfile.source, func.count(AudienceProfile.id))
        .group_by(AudienceProfile.source)
    )
    by_source = {r[0]: r[1] for r in source_r.all()}
    gender_r = await db.execute(
        select(AudienceProfile.gender, func.count(AudienceProfile.id))
        .where(AudienceProfile.gender.isnot(None))
        .group_by(AudienceProfile.gender)
    )
    by_gender = {r[0] or "Unknown": r[1] for r in gender_r.all()}
    return {
        "total": total,
        "hvp": hvp,
        "by_source": by_source,
        "by_gender": by_gender,
    }


@router.get("/admin/audience/profiles")
async def audience_profiles(
    admin: User = Depends(require_audience_access),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None),
    source: str | None = Query(None),
    is_hvp: bool | None = Query(None),
    gender: str | None = Query(None),
    age_bracket: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    q = select(AudienceProfile)
    if search:
        q = q.where(
            AudienceProfile.full_name.ilike(f"%{search}%")
            | AudienceProfile.email.ilike(f"%{search}%")
            | AudienceProfile.phone.ilike(f"%{search}%")
        )
    if source:
        q = q.where(AudienceProfile.source == source)
    if is_hvp is not None:
        q = q.where(AudienceProfile.is_hvp == is_hvp)
    if gender:
        q = q.where(AudienceProfile.gender == gender)
    if age_bracket:
        q = q.where(AudienceProfile.age_bracket == age_bracket)
    total_q = select(func.count()).select_from(q.subquery())
    total = await db.scalar(total_q)
    q = q.order_by(AudienceProfile.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    rows = result.scalars().all()
    return {
        "total": total or 0,
        "page": page,
        "per_page": per_page,
        "profiles": [
            {
                "id": p.id,
                "full_name": p.full_name,
                "email": p.email,
                "phone": p.phone,
                "gender": p.gender,
                "age_bracket": p.age_bracket,
                "location": p.location,
                "source": p.source,
                "is_hvp": p.is_hvp,
                "hvp_reason": p.hvp_reason,
                "company_domain": p.company_domain,
                "created_at": str(p.created_at),
            }
            for p in rows
        ],
    }


@router.get("/admin/audience/profiles/{profile_id}")
async def audience_profile_detail(
    profile_id: int,
    admin: User = Depends(require_audience_access),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AudienceProfile).where(AudienceProfile.id == profile_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, detail="Profile not found")
    return {
        "id": p.id,
        "full_name": p.full_name,
        "email": p.email,
        "phone": p.phone,
        "gender": p.gender,
        "age_bracket": p.age_bracket,
        "location": p.location,
        "source": p.source,
        "source_id": p.source_id,
        "event_id": p.event_id,
        "organizer_id": p.organizer_id,
        "is_hvp": p.is_hvp,
        "hvp_reason": p.hvp_reason,
        "company_domain": p.company_domain,
        "created_at": str(p.created_at),
        "updated_at": str(p.updated_at) if p.updated_at else None,
    }


@router.get("/admin/audience/export")
async def audience_export(
    request: Request,
    admin: User = Depends(require_audience_access),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None),
    source: str | None = Query(None),
    is_hvp: bool | None = Query(None),
    gender: str | None = Query(None),
    age_bracket: str | None = Query(None),
    fmt: str = Query("csv", alias="format"),
):
    q = select(AudienceProfile)
    if search:
        q = q.where(
            AudienceProfile.full_name.ilike(f"%{search}%")
            | AudienceProfile.email.ilike(f"%{search}%")
            | AudienceProfile.phone.ilike(f"%{search}%")
        )
    if source:
        q = q.where(AudienceProfile.source == source)
    if is_hvp is not None:
        q = q.where(AudienceProfile.is_hvp == is_hvp)
    if gender:
        q = q.where(AudienceProfile.gender == gender)
    if age_bracket:
        q = q.where(AudienceProfile.age_bracket == age_bracket)
    q = q.order_by(AudienceProfile.created_at.desc())
    result = await db.execute(q)
    rows = result.scalars().all()

    filter_desc = f"search={search}, source={source}, is_hvp={is_hvp}, gender={gender}, age_bracket={age_bracket}"
    hdr = f"Exported by: {admin.full_name} ({admin.email}) at {datetime.now(timezone.utc).isoformat()}"
    if fmt == "json":
        data = [
            {
                "id": p.id,
                "full_name": p.full_name,
                "email": p.email,
                "phone": p.phone,
                "gender": p.gender,
                "age_bracket": p.age_bracket,
                "location": p.location,
                "source": p.source,
                "is_hvp": p.is_hvp,
                "company_domain": p.company_domain,
                "_watermark": hdr,
            }
            for p in rows
        ]
        body = json.dumps(data, indent=2)
        media_type = "application/json"
        filename = "audience_export.json"
    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Full Name", "Email", "Phone", "Gender", "Age Bracket", "Location",
                         "Source", "Is HVP", "Company Domain", "Watermark"])
        for p in rows:
            writer.writerow([
                p.id, p.full_name, p.email, p.phone, p.gender or "",
                p.age_bracket or "", p.location or "", p.source,
                "Yes" if p.is_hvp else "No", p.company_domain or "", hdr,
            ])
        body = output.getvalue()
        media_type = "text/csv"
        filename = "audience_export.csv"

    export_log = AudienceExportLog(
        admin_id=admin.id,
        admin_email=admin.email,
        filter_description=filter_desc,
        row_count=len(rows),
        export_type=fmt,
        ip_address=request.client.host if request.client else None,
    )
    db.add(export_log)
    await log_action(
        db, admin.id, "audience_export", "audience",
        description=f"Exported {len(rows)} audience profiles ({fmt})",
    )
    await db.commit()

    return Response(
        content=body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/admin/audience/export-logs")
async def audience_export_logs(
    admin: User = Depends(require_audience_access),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    q = select(AudienceExportLog).order_by(AudienceExportLog.created_at.desc())
    total_q = select(func.count()).select_from(q.subquery())
    total = await db.scalar(total_q)
    q = q.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    rows = result.scalars().all()
    return {
        "total": total or 0,
        "page": page,
        "per_page": per_page,
        "logs": [
            {
                "id": r.id,
                "admin_id": r.admin_id,
                "admin_email": r.admin_email,
                "filter_description": r.filter_description,
                "row_count": r.row_count,
                "export_type": r.export_type,
                "created_at": str(r.created_at),
            }
            for r in rows
        ],
    }


@router.get("/admin/audience/demographics")
async def audience_demographics(
    admin: User = Depends(require_audience_access),
    db: AsyncSession = Depends(get_db),
):
    total = await db.scalar(select(func.count(AudienceProfile.id))) or 0
    hvp_count = await db.scalar(select(func.count(AudienceProfile.id)).where(AudienceProfile.is_hvp == True)) or 0
    men = await db.scalar(
        select(func.count(AudienceProfile.id)).where(AudienceProfile.gender.ilike("male"))
    ) or 0
    women = await db.scalar(
        select(func.count(AudienceProfile.id)).where(AudienceProfile.gender.ilike("female"))
    ) or 0
    age_r = await db.execute(
        select(AudienceProfile.age_bracket, func.count(AudienceProfile.id))
        .where(AudienceProfile.age_bracket.isnot(None))
        .group_by(AudienceProfile.age_bracket)
    )
    by_age = {r[0]: r[1] for r in age_r.all()}
    source_r = await db.execute(
        select(AudienceProfile.source, func.count(AudienceProfile.id))
        .group_by(AudienceProfile.source)
    )
    by_source = {r[0]: r[1] for r in source_r.all()}
    return {
        "total": total,
        "hvp": hvp_count,
        "men": men,
        "women": women,
        "unknown_gender": total - men - women,
        "by_age_bracket": by_age,
        "by_source": by_source,
    }
