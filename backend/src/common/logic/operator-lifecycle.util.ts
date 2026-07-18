/**
 * Pure, testable rules for the SuperAdmin Operator Management module:
 * the operator lifecycle state machine, suspension reasons, onboarding checklist,
 * and reactivation/delete guards.
 */
export type OperatorLifecycleStatus = 'PROVISIONING' | 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type SuspensionReason = 'MANUAL' | 'NON_PAYMENT' | 'FRAUD' | 'TEMPORARY' | 'PARTIAL';

export interface InvariantResult {
  ok: boolean;
  code?: string;
  message?: string;
}

/** The seven onboarding steps a operator must complete before activation. */
export interface OnboardingChecklist {
  kycCompleted: boolean;
  gstUploaded: boolean;
  documentsUploaded: boolean;
  mobileVerified: boolean;
  emailVerified: boolean;
  termsAccepted: boolean;
  adminCreated: boolean;
}

export const ONBOARDING_STEPS: (keyof OnboardingChecklist)[] = [
  'kycCompleted',
  'gstUploaded',
  'documentsUploaded',
  'mobileVerified',
  'emailVerified',
  'termsAccepted',
  'adminCreated',
];

// Allowed transitions of the operator lifecycle state machine.
const TRANSITIONS: Record<OperatorLifecycleStatus, OperatorLifecycleStatus[]> = {
  PROVISIONING: ['ONBOARDING', 'DELETED'],
  ONBOARDING: ['ACTIVE', 'SUSPENDED', 'DELETED'],
  ACTIVE: ['SUSPENDED', 'DELETED'],
  SUSPENDED: ['ACTIVE', 'DELETED'],
  DELETED: [],
};

export function canTransition(from: OperatorLifecycleStatus, to: OperatorLifecycleStatus): InvariantResult {
  if (!TRANSITIONS[from].includes(to)) {
    return { ok: false, code: 'OPERATOR_INVALID_TRANSITION', message: `A operator cannot move from ${from} to ${to}.` };
  }
  return { ok: true };
}

export function emptyChecklist(): OnboardingChecklist {
  return {
    kycCompleted: false,
    gstUploaded: false,
    documentsUploaded: false,
    mobileVerified: false,
    emailVerified: false,
    termsAccepted: false,
    adminCreated: false,
  };
}

export function pendingOnboardingSteps(checklist: OnboardingChecklist): (keyof OnboardingChecklist)[] {
  return ONBOARDING_STEPS.filter((step) => !checklist[step]);
}

export function onboardingComplete(checklist: OnboardingChecklist): boolean {
  return pendingOnboardingSteps(checklist).length === 0;
}

/** Activation requires a fully completed onboarding checklist. */
export function canActivate(status: OperatorLifecycleStatus, checklist: OnboardingChecklist): InvariantResult {
  if (status === 'ACTIVE') return { ok: false, code: 'OPERATOR_ALREADY_ACTIVE', message: 'The operator is already active.' };
  const transition = canTransition(status, 'ACTIVE');
  if (!transition.ok) return transition;
  if (!onboardingComplete(checklist)) {
    return { ok: false, code: 'OPERATOR_ONBOARDING_INCOMPLETE', message: `Onboarding is incomplete. Pending: ${pendingOnboardingSteps(checklist).join(', ')}.` };
  }
  return { ok: true };
}

export function canSuspend(status: OperatorLifecycleStatus): InvariantResult {
  if (!['ACTIVE', 'ONBOARDING'].includes(status)) {
    return { ok: false, code: 'OPERATOR_NOT_SUSPENDABLE', message: 'Only active or onboarding operators can be suspended.' };
  }
  return { ok: true };
}

export function canReactivate(status: OperatorLifecycleStatus): InvariantResult {
  if (status !== 'SUSPENDED') {
    return { ok: false, code: 'OPERATOR_NOT_SUSPENDED', message: 'Only a suspended operator can be reactivated.' };
  }
  return { ok: true };
}

/** Hard delete is allowed only for demo operators or operators already soft-deleted. */
export function canHardDelete(status: OperatorLifecycleStatus, isDemo: boolean): InvariantResult {
  if (!isDemo && status !== 'DELETED') {
    return { ok: false, code: 'OPERATOR_HARD_DELETE_FORBIDDEN', message: 'Only demo or already soft-deleted operators can be hard-deleted.' };
  }
  return { ok: true };
}
