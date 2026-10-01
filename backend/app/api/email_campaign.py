import csv
import io
import uuid
import asyncio
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.email_campaign import EmailCampaign, CampaignRecipient
from app.services.email_service import send_email
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/email-campaign", tags=["Email Campaign"])

YOUTUBE_URL = "https://youtu.be/rhjQWbsQ35A?si=QxPaXMvcAnaME0rw"
CAMPAIGN_FROM = "Airion Episode 2 <noreply@wristbandsng.com>"
LOGO_URL = f"{settings.FRONTEND_URL}/logo-dark-trim.png"


@router.post("/upload")
async def upload_csv(
    file: UploadFile = File(...),
    name: str = Form(...),
    youtube_url: str = Form(YOUTUBE_URL),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    text = content.decode("utf-8-sig")
    lines = text.strip().splitlines()
    if not lines:
        raise HTTPException(status_code=400, detail="Empty CSV file")

    reader = csv.DictReader(lines)
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV must have a header row")

    campaign = EmailCampaign(
        user_id=user.id,
        name=name,
        youtube_url=youtube_url,
        status="draft",
    )
    db.add(campaign)
    await db.flush()

    recipients = []
    for row in reader:
        recipient = CampaignRecipient(
            campaign_id=campaign.id,
            name=row.get("name", "").strip(),
            email=row.get("email", "").strip(),
            phone=row.get("phone", "").strip(),
            code=row.get("code", "").strip(),
            token=str(uuid.uuid4()),
        )
        recipients.append(recipient)

    db.add_all(recipients)
    campaign.total_contacts = len(recipients)
    await db.commit()
    await db.refresh(campaign)

    return {
        "id": campaign.id,
        "name": campaign.name,
        "total_contacts": campaign.total_contacts,
        "status": campaign.status,
    }


@router.get("/list")
async def list_campaigns(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmailCampaign)
        .where(EmailCampaign.user_id == user.id)
        .order_by(EmailCampaign.created_at.desc())
    )
    campaigns = result.scalars().all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "total_contacts": c.total_contacts,
            "sent_count": c.sent_count,
            "opened_count": c.opened_count,
            "clicked_count": c.clicked_count,
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in campaigns
    ]


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmailCampaign).where(
            EmailCampaign.id == campaign_id,
            EmailCampaign.user_id == user.id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    result = await db.execute(
        select(CampaignRecipient).where(CampaignRecipient.campaign_id == campaign_id)
    )
    recipients = result.scalars().all()

    return {
        "id": campaign.id,
        "name": campaign.name,
        "youtube_url": campaign.youtube_url,
        "total_contacts": campaign.total_contacts,
        "sent_count": campaign.sent_count,
        "opened_count": campaign.opened_count,
        "clicked_count": campaign.clicked_count,
        "status": campaign.status,
        "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
        "recipients": [
            {
                "id": r.id,
                "name": r.name,
                "email": r.email,
                "sent": r.sent,
                "opened": r.opened,
                "clicked": r.clicked,
                "error": r.error,
            }
            for r in recipients
        ],
    }


@router.post("/{campaign_id}/send")
async def send_campaign(
    campaign_id: int,
    count: int = 1000,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmailCampaign).where(
            EmailCampaign.id == campaign_id,
            EmailCampaign.user_id == user.id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status == "sending":
        raise HTTPException(status_code=400, detail="Campaign is already sending")

    result = await db.execute(
        select(CampaignRecipient).where(
            CampaignRecipient.campaign_id == campaign_id,
        )
    )
    all_recipients = result.scalars().all()

    if not all_recipients:
        raise HTTPException(status_code=400, detail="No recipients in campaign")

    import random
    selected = random.sample(all_recipients, min(count, len(all_recipients)))

    campaign.status = "sending"
    await db.commit()

    asyncio.create_task(_send_emails_background(campaign_id, [r.id for r in selected], db))

    return {
        "message": f"Sending to {len(selected)} recipients",
        "total_selected": len(selected),
    }


async def _send_emails_background(campaign_id: int, recipient_ids: list[int], db: AsyncSession):
    from app.core.database import async_session

    async with async_session() as session:
        result = await session.execute(
            select(EmailCampaign).where(EmailCampaign.id == campaign_id)
        )
        campaign = result.scalar_one_or_none()
        if not campaign:
            return

        result = await session.execute(
            select(CampaignRecipient).where(CampaignRecipient.id.in_(recipient_ids))
        )
        recipients = result.scalars().all()

        sent = 0
        for r in recipients:
            token = r.token
            tracking_url = f"{settings.FRONTEND_URL}/api/v1/email-campaign/click/{token}"

            html = _build_campaign_email(r.name, tracking_url, campaign.youtube_url)

            try:
                ok = await send_email(r.email, "🎬 Survival At All Cost: Airion Episode 2", html, from_addr=CAMPAIGN_FROM)
                if ok:
                    r.sent = True
                    r.sent_at = datetime.utcnow()
                    sent += 1
                else:
                    r.error = "Email send returned False"
            except Exception as e:
                r.error = str(e)
                logger.error(f"Failed to send to {r.email}: {e}")

        campaign.sent_count += sent
        await session.commit()


def _build_campaign_email(name: str, tracking_url: str, youtube_url: str) -> str:
    flyer_url = f"{settings.FRONTEND_URL}/uploads/airion_flyer.jpg"
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
<tr><td style="padding:20px 30px 10px;text-align:center">
<p style="font-size:14px;color:#333;line-height:1.5;margin:0 0 8px">Hi <strong>{name}</strong>,</p>
<p style="font-size:14px;color:#333;line-height:1.5;margin:0 0 8px">You're invited to watch <strong>Survival At All Cost: Airion Episode 2</strong>!</p>
<table cellpadding="0" cellspacing="0" style="margin:16px auto" role="presentation">
<tr><td>
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{tracking_url}" style="height:40px;v-text-anchor:middle;width:220px" arcsize="12%" strokecolor="#E91E8C" fillcolor="#E91E8C">
<w:anchorlock/>
<center style="color:#ffffff;font-size:15px;font-weight:bold">▶ WATCH NOW &amp; SUBSCRIBE</center>
</v:roundrect>
<![endif]-->
<a href="{tracking_url}" style="background-color:#E91E8C;border-radius:8px;padding:10px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;display:inline-block;mso-hide:all">▶ WATCH NOW & SUBSCRIBE</a>
</td></tr>
</table>
<p style="font-size:12px;color:#888;line-height:1.4;margin:0">After watching, don't forget to subscribe to the channel for more amazing content!</p>
</td></tr>
<tr><td style="padding:0">
<img src="{flyer_url}" alt="SURVIVAL AT ALL COST AIRION EPISODE 2" style="width:100%;height:auto;display:block" />
</td></tr>
<tr><td style="padding:20px 30px;text-align:center">
<hr style="border:none;border-top:1px solid #eee;margin:0 0 20px">
<p style="font-size:12px;color:#aaa;text-align:center">You received this email because you are part of our audience.</p>
<table cellpadding="0" cellspacing="0" style="margin:20px auto 0">
<tr><td align="center">
<img src="{LOGO_URL}" alt="accredit.vip" style="height:32px;width:auto;opacity:0.5" />
<p style="font-size:11px;color:#bbb;margin:8px 0 0">accredit.vip</p>
</td></tr>
</table>
</td></tr></table></td></tr></table>
</body>
</html>"""

@router.get("/click/{token}")
async def track_click(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CampaignRecipient).where(CampaignRecipient.token == token)
    )
    recipient = result.scalar_one_or_none()
    if not recipient:
        return RedirectResponse(url=YOUTUBE_URL)

    if not recipient.clicked:
        recipient.clicked = True
        recipient.clicked_at = datetime.utcnow()

        result = await db.execute(
            select(EmailCampaign).where(EmailCampaign.id == recipient.campaign_id)
        )
        campaign = result.scalar_one_or_none()
        if campaign:
            campaign.clicked_count += 1

        await db.commit()

    return RedirectResponse(url=YOUTUBE_URL)


@router.post("/{campaign_id}/recipient")
async def add_recipient(
    campaign_id: int,
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmailCampaign).where(
            EmailCampaign.id == campaign_id,
            EmailCampaign.user_id == user.id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    recipient = CampaignRecipient(
        campaign_id=campaign.id,
        name=name,
        email=email,
        phone=phone,
        code="",
        token=str(uuid.uuid4()),
    )
    db.add(recipient)
    campaign.total_contacts += 1
    await db.commit()
    await db.refresh(recipient)

    return {
        "id": recipient.id,
        "name": recipient.name,
        "email": recipient.email,
        "phone": recipient.phone,
        "sent": recipient.sent,
        "opened": recipient.opened,
        "clicked": recipient.clicked,
    }


@router.put("/{campaign_id}/recipient/{recipient_id}")
async def update_recipient(
    campaign_id: int,
    recipient_id: int,
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmailCampaign).where(
            EmailCampaign.id == campaign_id,
            EmailCampaign.user_id == user.id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    result = await db.execute(
        select(CampaignRecipient).where(
            CampaignRecipient.id == recipient_id,
            CampaignRecipient.campaign_id == campaign_id,
        )
    )
    recipient = result.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    recipient.name = name
    recipient.email = email
    recipient.phone = phone
    await db.commit()

    return {
        "id": recipient.id,
        "name": recipient.name,
        "email": recipient.email,
        "phone": recipient.phone,
        "sent": recipient.sent,
        "opened": recipient.opened,
        "clicked": recipient.clicked,
    }


@router.post("/{campaign_id}/send-single/{recipient_id}")
async def send_single(
    campaign_id: int,
    recipient_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmailCampaign).where(
            EmailCampaign.id == campaign_id,
            EmailCampaign.user_id == user.id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    result = await db.execute(
        select(CampaignRecipient).where(
            CampaignRecipient.id == recipient_id,
            CampaignRecipient.campaign_id == campaign_id,
        )
    )
    recipient = result.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    tracking_url = f"{settings.FRONTEND_URL}/api/v1/email-campaign/click/{recipient.token}"
    html = _build_campaign_email(recipient.name, tracking_url, campaign.youtube_url)

    try:
        ok = await send_email(recipient.email, "🎬 Survival At All Cost: Airion Episode 2", html, from_addr=CAMPAIGN_FROM)
        if ok:
            recipient.sent = True
            recipient.sent_at = datetime.utcnow()
            campaign.sent_count += 1
            await db.commit()
            return {"success": True, "message": f"Email sent to {recipient.name}"}
        else:
            recipient.error = "Email send returned False"
            await db.commit()
            raise HTTPException(status_code=500, detail="Email send returned False")
    except Exception as e:
        recipient.error = str(e)
        await db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{campaign_id}/recipients")
async def get_recipients(
    campaign_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmailCampaign).where(
            EmailCampaign.id == campaign_id,
            EmailCampaign.user_id == user.id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    result = await db.execute(
        select(CampaignRecipient).where(CampaignRecipient.campaign_id == campaign_id)
    )
    recipients = result.scalars().all()

    return [
        {
            "id": r.id,
            "name": r.name,
            "email": r.email,
            "sent": r.sent,
            "opened": r.opened,
            "clicked": r.clicked,
            "error": r.error,
        }
        for r in recipients
    ]
