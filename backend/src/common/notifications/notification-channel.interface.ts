/**
 * Contract for any outbound notification channel (Rule 169: interface over impl).
 * Email is live; WhatsApp/SMS are adapters that activate when provider creds exist.
 */
export interface NotificationContext {
  operatorId: string | null;
  recipientOperatorId?: string | null;
}

export interface NotificationChannel {
  readonly name: string;
  isEnabled(): boolean;
  send(
    to: string,
    template: string,
    vars: Record<string, unknown>,
    ctx: NotificationContext,
  ): Promise<{ channel: string; status: string }>;
}
