import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../customer/users/entities/user.entity';
import { EmailModule } from '../../integrations/email/email.module';
import { Bus } from './entities/bus.entity';
import { BusAmenity } from './entities/bus-amenity.entity';
import { Route } from '../routes/entities/route.entity';
import { Trip } from '../trips/entities/trip.entity';
import { SetupInvoice } from '../../finance/billing/entities/setup-invoice.entity';
import { Operator } from '../operators/entities/operator.entity';
import { BusesService } from './buses.service';
import { BusesController } from './buses.controller';
@Module({
  imports: [EmailModule, TypeOrmModule.forFeature([Bus, BusAmenity, Route, Trip, SetupInvoice, Operator, User])],
  controllers: [BusesController], providers: [BusesService], exports: [BusesService],
})
export class BusesModule {}
