"""Security-focused Pydantic schemas with validation"""

import re
from pydantic import BaseModel, EmailStr, field_validator, ConfigDict


class StrongPassword:
    """Custom password validator with strong requirements"""

    @staticmethod
    def validate(password: str) -> str:
        """Validate password meets security requirements"""
        if len(password) < 12:
            raise ValueError("Password must be at least 12 characters long")

        if not re.search(r'[A-Z]', password):
            raise ValueError("Password must contain at least one uppercase letter")

        if not re.search(r'[a-z]', password):
            raise ValueError("Password must contain at least one lowercase letter")

        if not re.search(r'[0-9]', password):
            raise ValueError("Password must contain at least one number")

        if not re.search(r'[!@#$%^&*()_\-+=\[\]{};:\'",.<>?/\|`~]', password):
            raise ValueError("Password must contain at least one special character (!@#$%^&*)")

        return password


class RegisterRequest(BaseModel):
    """Registration with strong validation"""
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str | None = None
    verification_channel: str = "email"
    device_fingerprint: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        return StrongPassword.validate(v)

    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_names(cls, v):
        if len(v) < 1 or len(v) > 100:
            raise ValueError("Name must be between 1 and 100 characters")
        return v.strip()


class ChangePasswordRequest(BaseModel):
    """Password change with validation"""
    current_password: str
    new_password: str
    confirm_password: str

    model_config = ConfigDict(extra="forbid")

    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v):
        return StrongPassword.validate(v)

    @field_validator('confirm_password')
    @classmethod
    def validate_confirm(cls, v, info):
        if v != info.data.get('new_password'):
            raise ValueError("Passwords do not match")
        return v


class SafeString:
    """Input validation for preventing injection attacks"""

    @staticmethod
    def validate(value: str, max_length: int = 255, field_name: str = "field") -> str:
        """Validate and sanitize string input"""
        if not isinstance(value, str):
            raise ValueError(f"{field_name} must be a string")

        if len(value) > max_length:
            raise ValueError(f"{field_name} must not exceed {max_length} characters")

        if len(value.strip()) == 0:
            raise ValueError(f"{field_name} cannot be empty")

        return value.strip()


class EventCreateRequest(BaseModel):
    """Event creation with strict validation"""
    title: str
    description: str
    event_type: str
    host_name: str
    venue: str
    guest_count_range: str
    event_date: str
    event_time: str
    category: str | None = None
    ticket_price: int | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        return SafeString.validate(v, max_length=255, field_name="title")

    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        if len(v) < 10:
            raise ValueError("Description must be at least 10 characters")
        return SafeString.validate(v, max_length=5000, field_name="description")

    @field_validator('host_name')
    @classmethod
    def validate_host_name(cls, v):
        return SafeString.validate(v, max_length=255, field_name="host_name")

    @field_validator('venue')
    @classmethod
    def validate_venue(cls, v):
        return SafeString.validate(v, max_length=500, field_name="venue")

    @field_validator('ticket_price')
    @classmethod
    def validate_ticket_price(cls, v):
        if v is not None and v < 0:
            raise ValueError("Ticket price cannot be negative")
        return v


class BankAccountRequest(BaseModel):
    """Bank account with validation"""
    bank_name: str
    account_number: str
    account_holder_name: str
    currency: str
    country_code: str

    model_config = ConfigDict(extra="forbid")

    @field_validator('bank_name', 'account_holder_name')
    @classmethod
    def validate_names(cls, v):
        return SafeString.validate(v, max_length=100, field_name="name")

    @field_validator('account_number')
    @classmethod
    def validate_account(cls, v):
        # Remove spaces
        v = v.replace(" ", "")
        if not v.isdigit() or len(v) < 8 or len(v) > 20:
            raise ValueError("Invalid account number")
        return v

    @field_validator('currency')
    @classmethod
    def validate_currency(cls, v):
        if len(v) != 3 or not v.isupper():
            raise ValueError("Currency must be a 3-letter code (e.g., USD, NGN)")
        return v

    @field_validator('country_code')
    @classmethod
    def validate_country(cls, v):
        if len(v) != 2 or not v.isupper():
            raise ValueError("Country code must be 2 letters (e.g., NG, US)")
        return v
