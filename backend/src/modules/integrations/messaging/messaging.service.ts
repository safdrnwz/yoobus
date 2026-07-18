import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationPolicyService } from '../../platform/notification-settings/notification-policy.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessagingUsage } from './entities/messaging-usage.entity';

/**
 * SMS + WhatsApp notifications. Mirrors EmailService: gated by config, dev-mode logs only,
 * and provider-ready (MSG91 / Twilio) when enabled with credentials. Never throws to callers —
 * a messaging failure must never break the core flow.
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger('Messaging');
  constructor(
    private readonly config: ConfigService,
    private readonly policy: NotificationPolicyService,
    @InjectRepository(MessagingUsage) private readonly usageRepo: Repository<MessagingUsage>,
  ) {}

  private ym(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

  /** Check remaining monthly credits for an operator's channel; returns true if room to send. */
  private async hasCredit(_operatorId: string, _channel: 'SMS' | 'WHATSAPP'): Promise<boolean> {
    // Messaging is billed per message now (no plan credit cap), so there is always room to send.
    return true;
  }

  private async consume(operatorId: string, channel: 'SMS' | 'WHATSAPP'): Promise<void> {
    const yearMonth = this.ym();
    const row = await this.usageRepo.findOne({ where: { operatorId, yearMonth, channel } });
    if (row) { row.count += 1; await this.usageRepo.save(row); }
    else await this.usageRepo.save(this.usageRepo.create({ operatorId, yearMonth, channel, count: 1 }));
  }

  private smsEnabled(): boolean { return this.config.get<boolean>('messaging.smsEnabled') === true; }
  private waEnabled(): boolean { return this.config.get<boolean>('messaging.whatsappEnabled') === true; }

  async sendSms(to: string, message: string): Promise<{ status: string }> {
    if (!to) return { status: 'SKIPPED' };
    if (!this.smsEnabled()) { this.logger.log(`[SMS dev] to=${to} :: ${message}`); return { status: 'DEV' }; }
    try {
      const authKey = this.config.get<string>('messaging.msg91AuthKey');
      const sender = this.config.get<string>('messaging.msg91Sender') ?? 'THKBUS';
      if (!authKey) { this.logger.warn('SMS enabled but MSG91_AUTHKEY missing'); return { status: 'NO_CREDENTIALS' }; }
      const res = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authkey: authKey },
        body: JSON.stringify({ sender, mobiles: to, message }),
      });
      return { status: res.ok ? 'SENT' : 'FAILED' };
    } catch (e) {
      this.logger.error(`SMS send failed: ${(e as Error).message}`);
      return { status: 'ERROR' };
    }
  }

  async sendWhatsApp(to: string, message: string): Promise<{ status: string }> {
    if (!to) return { status: 'SKIPPED' };
    if (!this.waEnabled()) { this.logger.log(`[WhatsApp dev] to=${to} :: ${message}`); return { status: 'DEV' }; }
    try {
      const token = this.config.get<string>('messaging.whatsappToken');
      const phoneId = this.config.get<string>('messaging.whatsappPhoneId');
      if (!token || !phoneId) { this.logger.warn('WhatsApp enabled but credentials missing'); return { status: 'NO_CREDENTIALS' }; }
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
      });
      return { status: res.ok ? 'SENT' : 'FAILED' };
    } catch (e) {
      this.logger.error(`WhatsApp send failed: ${(e as Error).message}`);
      return { status: 'ERROR' };
    }
  }

  /** Convenience: send the same message over every enabled channel. */
  /** Send over every enabled channel. When {operatorId,key} given, respects per-operator toggles. */
  async notify(phone: string, message: string, gate?: { operatorId: string | null; key: string }): Promise<void> {
    const op = gate?.operatorId ?? null;
    // Channel is sent only if: policy allows it AND (no operator context OR monthly credits remain).
    const smsOk = gate ? await this.policy.isAllowed(op, gate.key, 'SMS') : true;
    const waOk = gate ? await this.policy.isAllowed(op, gate.key, 'WHATSAPP') : true;
    if (smsOk && (!op || (await this.hasCredit(op, 'SMS')))) { await this.sendSms(phone, message); if (op) await this.consume(op, 'SMS'); }
    if (waOk && (!op || (await this.hasCredit(op, 'WHATSAPP')))) { await this.sendWhatsApp(phone, message); if (op) await this.consume(op, 'WHATSAPP'); }
  }
}
