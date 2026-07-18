import { IsDateString, IsOptional } from 'class-validator';

export class RunStatementDto {
  /** ISO date (YYYY-MM-DD). Defaults to yesterday. */
  @IsOptional() @IsDateString() date?: string;
}

import { Body, Controller, Post } from '@nestjs/common';
import { DailyStatementService } from './daily-statement.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

/** Manual trigger for the daily statement (testing / re-run a missed day). */
@Roles(Role.SUPERADMIN)
@Controller('operator/daily-statement')
export class DailyStatementController {
  constructor(private readonly statement: DailyStatementService) {}

  // Optionally pass { date: '2026-07-01' } to re-run for the day AFTER that date's night.
  @Post('run')
  run(@Body() body: RunStatementDto) {
    const ref = body?.date ? new Date(body.date) : new Date();
    return this.statement.run(ref);
  }
}
