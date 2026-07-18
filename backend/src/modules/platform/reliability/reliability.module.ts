import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackgroundJob } from './entities/background-job.entity';
import { DeploymentLog } from './entities/deployment-log.entity';
import { ImpersonationAudit } from './entities/impersonation-audit.entity';
import { ReliabilityService } from './reliability.service';
import { ReliabilityController } from './reliability.controller';
import { AuthModule } from '../../system/auth/auth.module';
import { UsersModule } from '../../customer/users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([BackgroundJob, DeploymentLog, ImpersonationAudit]), AuthModule, UsersModule],
  controllers: [ReliabilityController],
  providers: [ReliabilityService],
  exports: [ReliabilityService],
})
export class ReliabilityModule {}
