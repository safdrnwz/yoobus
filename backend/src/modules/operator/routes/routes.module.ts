import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from './entities/route.entity';
import { RouteStop } from './entities/route-stop.entity';
import { Trip } from '../trips/entities/trip.entity';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { StopsModule } from '../stops/stops.module';
@Module({
  imports: [TypeOrmModule.forFeature([Route, RouteStop, Trip]), StopsModule],
  controllers: [RoutesController], providers: [RoutesService], exports: [RoutesService],
})
export class RoutesModule {}
