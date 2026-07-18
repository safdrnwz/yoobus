import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DailyStatementService } from './daily-statement.service';

/** Fires every night at 00:05 to email each operator their previous-day statement. */
@Injectable()
export class DailyStatementScheduler {
  private readonly logger = new Logger('DailyStatementScheduler');
  constructor(private readonly statement: DailyStatementService) {}

  @Cron('5 0 * * *', { name: 'operator-daily-statement', timeZone: 'Asia/Kolkata' })
  async handle(): Promise<void> {
    try {
      const r = await this.statement.run();
      this.logger.log(`Daily statement run complete for ${r.window}`);
    } catch (e) {
      this.logger.error(`Daily statement failed: ${(e as Error).message}`);
    }
  }
}
