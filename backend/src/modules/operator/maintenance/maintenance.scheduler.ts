import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MaintenanceService } from './maintenance.service';

/** Periodically flips window statuses and sends due reminder emails. */
@Injectable()
export class MaintenanceScheduler {
  private readonly logger = new Logger('MaintenanceScheduler');
  constructor(private readonly maintenance: MaintenanceService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handle(): Promise<void> {
    try {
      await this.maintenance.tick();
    } catch (e) {
      this.logger.error(`Maintenance tick failed: ${(e as Error).message}`);
    }
  }
}
