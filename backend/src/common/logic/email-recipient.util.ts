// Email operator isolation: mail intended for one operator's staff must never reach
// another operator's staff. The recipient is always resolved from the correct context
// and is never broadcast across operators.

export interface Recipient {
  email: string;
  operatorId: string | null; // null = platform/passenger
  role: string;
}

// Operator-scoped notification: only recipients belonging to that operatorId.
export function resolveOperatorRecipients(
  all: Recipient[],
  operatorId: string,
  roles?: string[],
): Recipient[] {
  return all.filter(
    (r) =>
      r.operatorId === operatorId &&
      (!roles || roles.length === 0 || roles.includes(r.role)),
  );
}

// Passenger notification: only that passenger (operatorId is null and the email matches).
export function resolvePassengerRecipient(
  all: Recipient[],
  email: string,
): Recipient[] {
  const norm = (s: string) => s.trim().toLowerCase();
  return all.filter((r) => r.operatorId === null && norm(r.email) === norm(email));
}

// Guard: is it safe to send this operator-scoped mail to this recipient?
export function isCrossOperatorLeak(
  recipientOperatorId: string | null,
  notificationOperatorId: string,
): boolean {
  return recipientOperatorId !== notificationOperatorId;
}
