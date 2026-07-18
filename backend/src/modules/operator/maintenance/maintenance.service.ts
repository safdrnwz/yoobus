import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { MaintenanceWindow } from './entities/maintenance-window.entity';
import { Operator } from '../operators/entities/operator.entity';
import { OperatorStatus } from '../../../common/enums/operator-status.enum';
import { EmailService } from '../../integrations/email/email.service';
import { AppException } from '../../../common/errors/app-exception';
import { validateDuration, isActive, overlaps, dueReminderOffset } from '../../../common/logic/maintenance.util';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger('Maintenance');
  private cached: MaintenanceWindow | null = null;
  private cachedAt = 0;
  private static readonly CACHE_TTL_MS = 30 * 1000;

  constructor(
    @InjectRepository(MaintenanceWindow) private readonly repo: Repository<MaintenanceWindow>,
    @InjectRepository(Operator) private readonly operatorRepo: Repository<Operator>,
    private readonly email: EmailService,
  ) {}

  async create(superAdminId: string, dto: { startAt: string; endAt: string; message: string }): Promise<MaintenanceWindow> {
    const startMs = new Date(dto.startAt).getTime();
    const endMs = new Date(dto.endAt).getTime();
    const dur = validateDuration(startMs, endMs);
    if (!dur.ok) {
      const msg =
        dur.code === 'MAINTENANCE_TOO_SHORT'
          ? 'Maintenance must be at least 30 minutes'
          : dur.code === 'MAINTENANCE_TOO_LONG'
            ? 'Maintenance can be at most 1 hour'
            : 'Invalid maintenance time range';
      throw new AppException(dur.code!, msg, HttpStatus.BAD_REQUEST);
    }
    if (startMs <= Date.now()) throw new AppException('MAINTENANCE_PAST', 'Maintenance must be scheduled in the future', HttpStatus.BAD_REQUEST);

    const others = await this.repo.find({ where: { status: In(['SCHEDULED', 'ACTIVE']) } });
    for (const o of others) {
      if (overlaps(startMs, endMs, o.startAt.getTime(), o.endAt.getTime())) {
        throw new AppException('MAINTENANCE_OVERLAP', 'This overlaps an existing scheduled maintenance window', HttpStatus.CONFLICT);
      }
    }

    const win = await this.repo.save(
      this.repo.create({ startAt: new Date(startMs), endAt: new Date(endMs), message: dto.message, status: 'SCHEDULED', createdBy: superAdminId, remindersSent: [] }),
    );
    this.invalidateCache();
    // Immediate "scheduled" announcement to every operator (operator-isolated send).
    await this.broadcast(win, 'MAINTENANCE_SCHEDULED');
    return win;
  }

  list(): Promise<MaintenanceWindow[]> {
    return this.repo.find({ order: { startAt: 'DESC' } });
  }

  // Banner source for operator UIs: the active window, else the next upcoming one.
  async current(): Promise<MaintenanceWindow | null> {
    const now = Date.now();
    const active = await this.repo.findOne({ where: { status: 'ACTIVE' } });
    if (active) return active;
    const upcoming = await this.repo
      .createQueryBuilder('m')
      .where('m.status = :s', { s: 'SCHEDULED' })
      .andWhere('m.startAt > :now', { now: new Date(now) })
      .orderBy('m.startAt', 'ASC')
      .getOne();
    return upcoming ?? null;
  }

  async cancel(id: string): Promise<MaintenanceWindow> {
    const win = await this.repo.findOne({ where: { id } });
    if (!win) throw new AppException('MAINTENANCE_NOT_FOUND', 'Maintenance window not found', HttpStatus.NOT_FOUND);
    if (win.status === 'COMPLETED') throw new AppException('MAINTENANCE_COMPLETED', 'Cannot cancel a completed window', HttpStatus.BAD_REQUEST);
    win.status = 'CANCELLED';
    const saved = await this.repo.save(win);
    this.invalidateCache();
    return saved;
  }

  // Cached active-window lookup used by the guard on every mutating request.
  async getActiveWindowCached(): Promise<MaintenanceWindow | null> {
    const now = Date.now();
    if (now - this.cachedAt < MaintenanceService.CACHE_TTL_MS) return this.cached;
    const active = await this.repo.findOne({ where: { status: 'ACTIVE' } });
    let win = active;
    if (!win) {
      const scheduledNow = await this.repo.findOne({ where: { status: 'SCHEDULED' } });
      if (scheduledNow && isActive(now, scheduledNow.startAt.getTime(), scheduledNow.endAt.getTime())) win = scheduledNow;
    }
    this.cached = win ?? null;
    this.cachedAt = now;
    return this.cached;
  }

  private invalidateCache(): void {
    this.cached = null;
    this.cachedAt = 0;
  }

  // Called by the scheduler: flip statuses + send due daily reminders.
  async tick(): Promise<void> {
    const now = Date.now();
    const windows = await this.repo.find({ where: { status: In(['SCHEDULED', 'ACTIVE']) } });
    for (const win of windows) {
      const startMs = win.startAt.getTime();
      const endMs = win.endAt.getTime();
      if (win.status === 'SCHEDULED' && now >= startMs && now < endMs) {
        win.status = 'ACTIVE';
        await this.repo.save(win);
        this.invalidateCache();
      } else if (now >= endMs && win.status !== 'COMPLETED') {
        win.status = 'COMPLETED';
        await this.repo.save(win);
        this.invalidateCache();
        continue;
      }
      const due = dueReminderOffset(now, startMs, win.remindersSent ?? []);
      if (due !== null) {
        await this.broadcast(win, 'MAINTENANCE_REMINDER', due);
        win.remindersSent = [...(win.remindersSent ?? []), due];
        await this.repo.save(win);
      }
    }
  }

  private async broadcast(win: MaintenanceWindow, template: string, daysBefore?: number): Promise<void> {
    const operators = await this.operatorRepo.find({ where: { status: Not(OperatorStatus.SUSPENDED) } });
    for (const op of operators) {
      try {
        await this.email.send({
          to: op.email,
          template,
          vars: { operatorName: op.brandName || op.legalName, startAt: win.startAt.toISOString(), endAt: win.endAt.toISOString(), message: win.message, daysBefore },
          operatorId: op.id,
          recipientOperatorId: op.id,
        });
      } catch (e) {
        this.logger.error(`Maintenance email to operator ${op.id} failed: ${(e as Error).message}`);
      }
    }
  }
}
