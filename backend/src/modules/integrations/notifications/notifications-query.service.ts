import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog } from '../email/email-log.entity';

/** Read side for the delivery log (previously written but never surfaced). */
@Injectable()
export class NotificationsQueryService {
  constructor(@InjectRepository(EmailLog) private readonly logRepo: Repository<EmailLog>) {}

  /** A customer's own recent notifications (by their email). */
  async myHistory(email: string, limit = 50) {
    const rows = await this.logRepo.find({ where: { toEmail: email }, order: { createdAt: 'DESC' }, take: limit });
    return rows.map((r) => ({ template: r.template, subject: r.subject, status: r.status, sentAt: r.createdAt }));
  }

  /** An operator's recent delivery log (audit). */
  async operatorLog(operatorId: string, limit = 100) {
    const rows = await this.logRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' }, take: limit });
    return rows.map((r) => ({ to: r.toEmail, template: r.template, subject: r.subject, status: r.status, error: r.error, sentAt: r.createdAt }));
  }

  /** Delivery stats: totals by status + top templates. operatorId null => platform-wide. */
  async stats(operatorId: string | null) {
    const where = operatorId ? { operatorId } : {};
    const rows = await this.logRepo.find({ where, select: ['status', 'template'] });
    const byStatus: Record<string, number> = { SENT: 0, FAILED: 0, DEV: 0 };
    const byTemplate: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byTemplate[r.template] = (byTemplate[r.template] || 0) + 1;
    }
    const topTemplates = Object.entries(byTemplate).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([template, count]) => ({ template, count }));
    return { total: rows.length, byStatus, topTemplates };
  }
}
