import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperatorNotificationPreference } from './entities/notification-settings.entities';
import { NOTIFICATION_CATALOG, notifDef } from '../../../common/logic/notification-catalog';

/**
 * Notification gate — operator level only.
 *
 * Plans were removed, so the old per-plan policy layer is gone. Mandatory notifications
 * (OTP, payment, refund, booking) always go out; every other notification respects the
 * operator's own per-channel preference, defaulting to ON.
 */
@Injectable()
export class NotificationPolicyService {
  constructor(
    @InjectRepository(OperatorNotificationPreference) private readonly prefRepo: Repository<OperatorNotificationPreference>,
  ) {}

  /** The core check used by EmailService / MessagingService before sending. */
  async isAllowed(operatorId: string | null, key: string, channel: 'EMAIL' | 'SMS' | 'WHATSAPP' = 'EMAIL'): Promise<boolean> {
    if (!operatorId) return true;            // platform mail (no operator context) always goes
    const def = notifDef(key);
    if (def?.mandatory) return true;         // mandatory notifications can never be switched off
    const prefRow = await this.prefRepo.findOne({ where: { operatorId, notificationKey: key, channel } });
    return prefRow?.enabled ?? true;         // default ON
  }

  // ---- Operator: per-channel preference ----
  async operatorPrefs(operatorId: string) {
    const rows = await this.prefRepo.find({ where: { operatorId } });
    const byKeyCh = new Map(rows.map((r) => [`${r.notificationKey}:${r.channel}`, r.enabled]));
    return NOTIFICATION_CATALOG.filter((n) => !n.mandatory).map((n) => ({
      key: n.key, label: n.label, audience: n.audience,
      email: byKeyCh.get(`${n.key}:EMAIL`) ?? true,
      sms: byKeyCh.get(`${n.key}:SMS`) ?? true,
      whatsapp: byKeyCh.get(`${n.key}:WHATSAPP`) ?? true,
    }));
  }

  async setOperatorPref(operatorId: string, notificationKey: string, channel: string, enabled: boolean) {
    const existing = await this.prefRepo.findOne({ where: { operatorId, notificationKey, channel } });
    if (existing) { existing.enabled = enabled; return this.prefRepo.save(existing); }
    return this.prefRepo.save(this.prefRepo.create({ operatorId, notificationKey, channel, enabled }));
  }
}
