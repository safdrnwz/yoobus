/** Registry of every notification and how it may be toggled. Pure data + helpers (testable). */
export type NotifChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';
export type NotifAudience = 'CUSTOMER' | 'OPERATOR' | 'STAFF' | 'PLATFORM';

export interface NotifDef {
  key: string;          // matches an email template key (and/or an SMS/WhatsApp event)
  label: string;
  audience: NotifAudience;
  mandatory: boolean;   // mandatory notifications can never be switched off (security/transactional/legal)
}

/**
 * Mandatory = always sent (OTP, password, payment, refund, core booking + operator lifecycle).
 * Everything else is optional and can be toggled by plan (superadmin) and by operator.
 */
export const NOTIFICATION_CATALOG: NotifDef[] = [
  // --- Mandatory (cannot be disabled) ---
  { key: 'OTP_REGISTER', label: 'Registration OTP', audience: 'CUSTOMER', mandatory: true },
  { key: 'OTP_LOGIN', label: 'Login OTP', audience: 'CUSTOMER', mandatory: true },
  { key: 'PASSWORD_RESET', label: 'Password reset', audience: 'CUSTOMER', mandatory: true },
  { key: 'PASSWORD_CHANGED', label: 'Password changed', audience: 'CUSTOMER', mandatory: true },
  { key: 'BOOKING_CONFIRMED', label: 'Booking confirmed', audience: 'CUSTOMER', mandatory: true },
  { key: 'BOOKING_CANCELLED', label: 'Booking cancelled', audience: 'CUSTOMER', mandatory: true },
  { key: 'PAYMENT_SUCCESS', label: 'Payment success', audience: 'CUSTOMER', mandatory: true },
  { key: 'PAYMENT_FAILED', label: 'Payment failed', audience: 'CUSTOMER', mandatory: true },
  { key: 'REFUND_PROCESSED', label: 'Refund processed', audience: 'CUSTOMER', mandatory: true },
  { key: 'OPERATOR_APPROVED', label: 'Operator approved', audience: 'OPERATOR', mandatory: true },
  { key: 'OPERATOR_REJECTED', label: 'Operator rejected', audience: 'OPERATOR', mandatory: true },
  { key: 'OPERATOR_SUSPENDED', label: 'Operator suspended', audience: 'OPERATOR', mandatory: true },
  { key: 'OPERATOR_REACTIVATED', label: 'Operator reactivated', audience: 'OPERATOR', mandatory: true },

  // --- Optional: customer-facing ---
  { key: 'WELCOME_USER', label: 'Welcome email', audience: 'CUSTOMER', mandatory: false },
  { key: 'PAYMENT_REMINDER', label: 'Payment reminder', audience: 'CUSTOMER', mandatory: false },
  { key: 'TRIP_REMINDER', label: 'Trip reminder', audience: 'CUSTOMER', mandatory: false },
  { key: 'REVIEW_REQUEST', label: 'Review request', audience: 'CUSTOMER', mandatory: false },
  { key: 'BOOKING_RESCHEDULED', label: 'Booking rescheduled', audience: 'CUSTOMER', mandatory: false },
  { key: 'TRIP_CANCELLED', label: 'Trip cancelled', audience: 'CUSTOMER', mandatory: false },
  { key: 'TRIP_DISRUPTION', label: 'Trip disruption', audience: 'CUSTOMER', mandatory: false },
  { key: 'SEAT_UPGRADE_OFFER', label: 'Seat upgrade offer', audience: 'CUSTOMER', mandatory: false },
  { key: 'PASSENGER_TRANSFER_DONE', label: 'Passenger transfer', audience: 'CUSTOMER', mandatory: false },
  { key: 'SEAT_AVAILABLE_ALERT', label: 'Seat available alert', audience: 'CUSTOMER', mandatory: false },
  { key: 'WALLET_CREDITED', label: 'Wallet credited', audience: 'CUSTOMER', mandatory: false },
  { key: 'FARE_FROZEN', label: 'Fare frozen', audience: 'CUSTOMER', mandatory: false },

  // --- Optional: operator / staff-facing ---
  { key: 'DRIVER_DUTY_ASSIGNED', label: 'Driver duty assigned', audience: 'STAFF', mandatory: false },
  { key: 'STAFF_CREATED', label: 'Staff account created', audience: 'STAFF', mandatory: false },
  { key: 'SETUP_INVOICE', label: 'Setup invoice', audience: 'OPERATOR', mandatory: false },
  { key: 'MAINTENANCE_SCHEDULED', label: 'Maintenance scheduled', audience: 'STAFF', mandatory: false },
  { key: 'MAINTENANCE_REMINDER', label: 'Maintenance reminder', audience: 'STAFF', mandatory: false },
  { key: 'DOMAIN_VERIFIED', label: 'Domain verified', audience: 'OPERATOR', mandatory: false },
  { key: 'SETTLEMENT_PAID', label: 'Settlement paid', audience: 'OPERATOR', mandatory: false },
  { key: 'LOW_RATING_ALERT', label: 'Low rating alert', audience: 'OPERATOR', mandatory: false },
  { key: 'COMMISSION_UPDATED', label: 'Commission updated', audience: 'OPERATOR', mandatory: false },
  { key: 'OPERATOR_DAILY_STATEMENT', label: 'Daily statement', audience: 'OPERATOR', mandatory: false },
  { key: 'APPROVAL_REQUESTED', label: 'Approval requested', audience: 'STAFF', mandatory: false },
  { key: 'APPROVAL_APPROVED', label: 'Approval approved', audience: 'STAFF', mandatory: false },
  { key: 'APPROVAL_REJECTED', label: 'Approval rejected', audience: 'STAFF', mandatory: false },
  { key: 'SUPPORT_TICKET_CREATED', label: 'Support ticket created', audience: 'OPERATOR', mandatory: false },
  { key: 'SUPPORT_TICKET_RESOLVED', label: 'Support ticket resolved', audience: 'CUSTOMER', mandatory: false },
];

const BY_KEY = new Map(NOTIFICATION_CATALOG.map((n) => [n.key, n]));
export function notifDef(key: string): NotifDef | undefined { return BY_KEY.get(key); }
export function isMandatory(key: string): boolean { return BY_KEY.get(key)?.mandatory ?? false; }

/**
 * Resolve whether a notification may be sent, given plan + operator toggles.
 * Rules: mandatory => always; unknown key => always (fail-open so new templates still send);
 * a plan-level OFF or an operator-level OFF => suppressed.
 */
export function resolveAllowed(params: {
  key: string;
  planEnabled?: boolean | null;     // undefined/null => not configured (treated as ON)
  operatorEnabled?: boolean | null; // undefined/null => not configured (treated as ON)
}): boolean {
  if (isMandatory(params.key)) return true;
  if (!BY_KEY.has(params.key)) return true;
  if (params.planEnabled === false) return false;
  if (params.operatorEnabled === false) return false;
  return true;
}
