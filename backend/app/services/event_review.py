"""Event review and keyword scanning service for fraud detection."""

SUSPICIOUS_KEYWORDS = [
    "crypto", "bitcoin", "btc", "ethereum", "forex", "trading",
    "investment", "returns", "ponzi", "mlm", "pyramid", "job offer",
    "job vacancy", "employment", "recruitment", "whatsapp group",
    "telegram channel", "free money", "guaranteed profit", "100% profit"
]


def scan_for_keywords(text: str) -> list[str]:
    """Scan text for suspicious keywords (case-insensitive).

    Returns a list of matched keywords found in the text.
    """
    if not text:
        return []

    text_lower = text.lower()
    matched = []

    for keyword in SUSPICIOUS_KEYWORDS:
        if keyword in text_lower:
            matched.append(keyword)

    return matched


def compute_review_status(is_public: bool, matched_keywords: list[str]) -> str:
    """Compute the appropriate review_status based on event visibility and keywords.

    - Private events (is_public=False) → "auto_approved" (no review needed)
    - Public events with suspicious keywords → "flagged"
    - Public events without keywords → "pending_review"
    """
    if not is_public:
        return "auto_approved"

    if matched_keywords:
        return "flagged"

    return "pending_review"
