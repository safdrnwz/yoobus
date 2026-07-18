import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceWindow } from './entities/maintenance-window.entity';
import { Operator } from '../operators/entities/operator.entity';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceScheduler } from './maintenance.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceWindow, Operator])],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceScheduler],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
