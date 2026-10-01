"""Phone number validation and normalization service."""

import re
from typing import Optional, Tuple
from phonenumbers import parse as parse_phone, is_valid_number, country_code_for_region
from phonenumbers.geocoder import description_for_number
from phonenumbers import phonenumberutil
import pycountry


class PhoneValidator:
    """Validates and normalizes phone numbers."""
    
    # Map of country prefixes to country codes
    COUNTRY_PREFIXES = {
        "234": "NG",  # Nigeria
        "255": "TZ",  # Tanzania
        "256": "UG",  # Uganda
        "254": "KE",  # Kenya
        "27": "ZA",   # South Africa
        "1": "US",    # USA/Canada
        "44": "GB",   # UK
        "33": "FR",   # France
        "49": "DE",   # Germany
        "39": "IT",   # Italy
        "34": "ES",   # Spain
        "91": "IN",   # India
        "86": "CN",   # China
        "81": "JP",   # Japan
    }
    
    @staticmethod
    def get_country_code(phone_number: str) -> Optional[str]:
        """Extract country code from phone number."""
        # Remove all non-digit characters except +
        cleaned = re.sub(r'[^\d+]', '', phone_number)
        
        # Remove leading +
        if cleaned.startswith('+'):
            cleaned = cleaned[1:]
        
        # Handle Nigerian local numbers (08xxx becomes 234)
        if cleaned.startswith('0') and len(cleaned) == 11:
            cleaned = '234' + cleaned[1:]
        
        # Find matching country prefix
        for prefix, country_code in PhoneValidator.COUNTRY_PREFIXES.items():
            if cleaned.startswith(prefix):
                return country_code
        
        return None
    
    @staticmethod
    def get_country_flag(country_code: Optional[str]) -> str:
        """Get flag emoji for country code."""
        if not country_code or len(country_code) != 2:
            return "🌍"
        
        # Convert country code to flag emoji
        flag = ""
        for char in country_code.upper():
            flag += chr(ord(char) - ord('A') + 0x1F1E6)
        return flag
    
    @staticmethod
    def get_country_name(country_code: Optional[str]) -> str:
        """Get country name from country code."""
        if not country_code:
            return "Unknown"
        
        try:
            country = pycountry.countries.get(alpha_2=country_code)
            return country.name if country else "Unknown"
        except:
            return "Unknown"
    
    @staticmethod
    def normalize_phone_number(phone_number: str, default_country: str = "NG") -> Tuple[Optional[str], bool, str]:
        """
        Normalize phone number to E.164 format.
        
        Returns:
            Tuple of (normalized_number, is_valid, country_code)
        """
        if not phone_number or not isinstance(phone_number, str):
            return None, False, ""
        
        try:
            # Try to parse the number
            parsed = parse_phone(phone_number, default_country)
            
            # Validate the number
            is_valid = is_valid_number(parsed)
            
            # Get the E.164 format (international format)
            if is_valid:
                normalized = f"+{parsed.country_code}{parsed.national_number}"
                country_code = None
                
                # Get country code
                for region_code in PhoneValidator.COUNTRY_PREFIXES.values():
                    if country_code_for_region(region_code) == parsed.country_code:
                        country_code = region_code
                        break
                
                return normalized, is_valid, country_code or ""
            else:
                return None, False, ""
                
        except phonenumberutil.NumberParseException:
            return None, False, ""
    
    @staticmethod
    def validate_and_format(phone_number: str, default_country: str = "NG") -> dict:
        """
        Validate and format phone number with all details.
        
        Returns:
            {
                "original": original number,
                "normalized": normalized number in E.164 format,
                "is_valid": boolean,
                "country_code": country code (e.g., "NG"),
                "country_name": country name,
                "flag": country flag emoji,
                "error": error message if invalid
            }
        """
        normalized, is_valid, country_code = PhoneValidator.normalize_phone_number(
            phone_number, 
            default_country
        )
        
        country_name = PhoneValidator.get_country_name(country_code) if country_code else "Unknown"
        flag = PhoneValidator.get_country_flag(country_code) if country_code else "🌍"
        
        error = None
        if not is_valid:
            error = "Invalid phone number format"
        
        return {
            "original": phone_number,
            "normalized": normalized,
            "is_valid": is_valid,
            "country_code": country_code,
            "country_name": country_name,
            "flag": flag,
            "error": error,
        }


def validate_email(email: str) -> bool:
    """Validate email address."""
    if not email or not isinstance(email, str):
        return False
    
    # Basic email regex
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))
