import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartInventory, VehicleDocument, WorkOrder } from './entities/fleet.entities';
import { Bus } from '../buses/entities/bus.entity';
import { UploadsModule } from '../../integrations/uploads/uploads.module';
import { FleetService } from './fleet.service';
import { FleetController } from './fleet.controller';

@Module({
  imports: [UploadsModule, TypeOrmModule.forFeature([WorkOrder, VehicleDocument, PartInventory, Bus])],
  controllers: [FleetController],
  providers: [FleetService],
  exports: [FleetService],
})
export class FleetModule {}
