import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';

/** System domain barrel — aggregates all system feature modules. */
@Module({
  imports: [AuthModule, HealthModule],
  exports: [AuthModule, HealthModule],
})
export class SystemModule {}
