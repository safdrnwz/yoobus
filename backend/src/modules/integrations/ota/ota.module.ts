import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from '../../platform/api-management/entities/api-key.entity';
import { User } from '../../customer/users/entities/user.entity';
import { TripsModule } from '../../operator/trips/trips.module';
import { BookingsModule } from '../../booking/bookings/bookings.module';
import { OtaService } from './ota.service';
import { OtaController } from './ota.controller';
import { OtaApiKeyGuard } from './ota-apikey.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey, User]), TripsModule, BookingsModule],
  controllers: [OtaController],
  providers: [OtaService, OtaApiKeyGuard],
  exports: [OtaService],
})
export class OtaModule {}
