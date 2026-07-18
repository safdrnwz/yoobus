import { Module } from '@nestjs/common';
import { ReportsModule } from './reports/reports.module';

/** Shared domain barrel — aggregates all shared feature modules. */
@Module({
  imports: [ReportsModule],
  exports: [ReportsModule],
})
export class SharedModule {}
