import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSubjectRequest } from './entities/data-subject-request.entity';
import { ConsentRecord } from './entities/consent-record.entity';
import { KeyRotation } from './entities/key-rotation.entity';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DataSubjectRequest, ConsentRecord, KeyRotation])],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
