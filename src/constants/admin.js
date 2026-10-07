/** Shared enums for the super-admin panel's modules (wallet, betting, risk, commission, …). */
const TRANSACTION_TYPES = ['Deposit', 'Withdrawal', 'Bet Win', 'Bet Loss', 'Adjustment', 'Commission', 'Payment'];
const TRANSACTION_STATUSES = ['Pending', 'Completed', 'Failed'];

const WALLET_REQUEST_KINDS = ['deposit', 'withdrawal'];
const WALLET_REQUEST_STATUSES = ['Pending', 'Approved', 'Rejected'];

/** Sports players can bet on for now; events for anything else can't be created. */
const ENABLED_SPORTS = ['Cricket'];

const EVENT_STATUSES = ['Live', 'Upcoming', 'Suspended', 'Completed', 'Settled'];
const MARKET_STATUSES = ['Active', 'Suspended'];
const BET_STATUSES = ['Pending', 'Won', 'Lost', 'Void', 'Cashed Out'];

const COMMISSION_LEVELS = ['Franchise', 'Super Agent', 'Agent'];
const COMMISSION_STATUSES = ['Pending', 'Settled'];

/** Staff account commission models, mirroring the Create Franchise modal. */
const COMMISSION_TYPES = ['Flat', 'Slab based', 'Turnover based'];
const SETTLEMENT_CYCLES = ['Daily', 'Weekly', 'Monthly'];

/** Documents a player can submit for KYC, matching the app's picker. */
const KYC_DOCUMENT_TYPES = ['Aadhaar Card', 'PAN Card', 'Passport', 'Voter ID', 'Driving License'];
/** 'Not Submitted' until the player sends documents; 'Pending' means awaiting review. */
const KYC_STATUSES = ['Not Submitted', 'Pending', 'Verified', 'Rejected'];

const PARTNER_STATUSES = ['Active', 'Inactive', 'Pending'];

const TICKET_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const CMS_KINDS = ['Announcement', 'Banner', 'Promotion', 'Notice'];
const CMS_STATUSES = ['Draft', 'Published', 'Archived'];

/** risk / wallet / general feed the admin panel; the rest are the player app's (notification.service.js#notifyPlayer). */
const NOTIFICATION_CATEGORIES = ['risk', 'wallet', 'general', 'bet', 'live', 'kyc', 'security', 'promo'];
/** Screen a player notification opens in the app when tapped. */
const NOTIFICATION_LINKS = ['', 'wallet', 'bets', 'live', 'kyc', 'profile'];

module.exports = {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  WALLET_REQUEST_KINDS,
  WALLET_REQUEST_STATUSES,
  ENABLED_SPORTS,
  EVENT_STATUSES,
  MARKET_STATUSES,
  BET_STATUSES,
  COMMISSION_LEVELS,
  COMMISSION_STATUSES,
  COMMISSION_TYPES,
  KYC_DOCUMENT_TYPES,
  KYC_STATUSES,
  SETTLEMENT_CYCLES,
  PARTNER_STATUSES,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  CMS_KINDS,
  CMS_STATUSES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_LINKS,
};
