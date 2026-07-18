/**
 * Application constants. All tunable config values live in the single source of truth
 * (common/config/platform-defaults). This file re-exports them for existing call sites
 * and adds purely structural maps that are not runtime configuration.
 */
export {
  SEAT_HOLD_TTL_MINUTES,
  PAYMENT_WINDOW_MINUTES,
  RESCHEDULE_MIN_HOURS_BEFORE_DEPARTURE,
  BCRYPT_SALT_ROUNDS,
  PNR_LENGTH,
} from '../config/platform-defaults';

export const OWNER_TYPE = { USER: 'USER', AGENT: 'AGENT' } as const;
export const LEDGER_ENTRY = { CREDIT: 'CREDIT', DEBIT: 'DEBIT' } as const;
