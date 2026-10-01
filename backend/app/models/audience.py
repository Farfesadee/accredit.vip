from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from app.core.database import Base


FREE_DOMAINS = frozenset({
    "gmail.com", "yahoo.com", "yahoo.co.uk", "yahoo.fr", "yahoo.de",
    "hotmail.com", "hotmail.co.uk", "outlook.com", "outlook.fr",
    "aol.com", "icloud.com", "mail.com", "protonmail.com", "proton.me",
    "yandex.com", "live.com", "live.co.uk", "msn.com",
})


def is_hvp_email(email: str | None) -> bool:
    if not email or "@" not in email:
        return False
    domain = email.split("@", 1)[1].lower().strip()
    return domain not in FREE_DOMAINS


def company_domain(email: str | None) -> str | None:
    if not email or "@" not in email:
        return None
    return email.split("@", 1)[1].lower().strip()


def infer_age_bracket(dob: str | None) -> str | None:
    if not dob:
        return None
    try:
        from datetime import datetime
        birth = datetime.strptime(dob.split("T")[0][:10], "%Y-%m-%d")
        age = (datetime.utcnow() - birth).days // 365
        if age < 18:
            return "Under 18"
        elif age < 25:
            return "18-24"
        elif age < 35:
            return "25-34"
        elif age < 50:
            return "35-49"
        else:
            return "50+"
    except (ValueError, IndexError):
        return None


class AudienceProfile(Base):
    __tablename__ = "audience_profiles"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=True, index=True)
    phone = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    age_bracket = Column(String, nullable=True)
    location = Column(String, nullable=True)

    source = Column(String, nullable=False)  # user / ticket / guest
    source_id = Column(Integer, nullable=False)
    event_id = Column(Integer, nullable=True)
    organizer_id = Column(Integer, nullable=True)

    is_hvp = Column(Boolean, default=False, index=True)
    hvp_reason = Column(String, nullable=True)
    company_domain = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AudienceExportLog(Base):
    __tablename__ = "audience_export_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, nullable=False, index=True)
    admin_email = Column(String, nullable=False)
    filter_description = Column(String, nullable=True)
    row_count = Column(Integer, default=0)
    export_type = Column(String, default="csv")  # csv / json
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
