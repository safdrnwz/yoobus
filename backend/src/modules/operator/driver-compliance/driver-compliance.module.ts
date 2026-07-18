import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverDocument, DriverTraining, DriverViolation } from './entities/compliance.entities';
import { DriverComplianceService } from './driver-compliance.service';
import { DriverComplianceController } from './driver-compliance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DriverDocument, DriverViolation, DriverTraining])],
  controllers: [DriverComplianceController],
  providers: [DriverComplianceService],
  exports: [DriverComplianceService],
})
export class DriverComplianceModule {}
