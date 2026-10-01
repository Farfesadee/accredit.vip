from app.models.user import User
from app.models.event import Event
from app.models.guest import Guest
from app.models.invite import InviteMessage, InviteBatch
from app.models.qr_code import QRCode
from app.models.checkin import CheckIn
from app.models.payment import Payment
from app.models.audit_log import AuditLog
from app.models.event_settings import EventSetting
from app.models.support_ticket import SupportTicket
from app.models.attachment import Attachment
from app.models.flier import FlierAsset
from app.models.accreditation import AccreditationRequest
from app.models.staff import StaffAssignment
from app.models.ticket_purchase import TicketPurchase
from app.models.password_reset import PasswordResetToken
from app.models.trial_usage import TrialUsage
from app.models.subscription import Subscription
from app.models.community_post import CommunityPost
from app.models.data_management import DataGroup, DataProfile, DataRequest
from app.models.waitlist import WaitlistEntry
from app.models.audience import AudienceProfile, AudienceExportLog
from app.models.coupon import Coupon
from app.models.rsvp_question import RSVPQuestion, RSVPAnswer
from app.models.event_template import EventTemplate
from app.models.wallet import Wallet, WalletTransaction, BankAccount, Withdrawal
from app.models.pickup import Pickup, PickupUser
from app.models.email_campaign import EmailCampaign, CampaignRecipient
from app.models.announcement import Announcement
from app.models.platform_setting import PlatformSetting

all_models = [
    User, Event, Guest, InviteMessage, InviteBatch, QRCode, CheckIn,
    Payment, AuditLog, EventSetting, SupportTicket, Attachment,
    FlierAsset, AccreditationRequest, StaffAssignment, TicketPurchase,
    PasswordResetToken, TrialUsage, Subscription, CommunityPost,
    DataGroup, DataProfile, DataRequest, WaitlistEntry, Coupon,
    RSVPQuestion, RSVPAnswer, EventTemplate, Wallet, WalletTransaction,
    BankAccount, Withdrawal, AudienceProfile, AudienceExportLog,
    Pickup, PickupUser, EmailCampaign, CampaignRecipient, Announcement,
    PlatformSetting,
]
