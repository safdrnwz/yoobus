import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance, Employee, LeaveRequest, Shift } from './entities/crew.entities';
import { CrewHrService } from './crew-hr.service';
import { CrewHrController } from './crew-hr.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, Shift, Attendance, LeaveRequest])],
  controllers: [CrewHrController],
  providers: [CrewHrService],
  exports: [CrewHrService],
})
export class CrewHrModule {}
