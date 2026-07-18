import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from './entities/driver.entity';
import { Bus } from '../buses/entities/bus.entity';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
@Module({
  imports: [TypeOrmModule.forFeature([Driver, Bus])],
  controllers: [DriversController], providers: [DriversService], exports: [DriversService],
})
export class DriversModule {}
