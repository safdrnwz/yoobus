import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FareLock } from './entities/fare-lock.entity';
import { TripsModule } from '../../operator/trips/trips.module';
import { UsersModule } from '../../customer/users/users.module';
import { EmailModule } from '../../integrations/email/email.module';
import { FareFreezeService } from './fare-freeze.service';
import { FareFreezeController } from './fare-freeze.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FareLock]), TripsModule, ConfigModule, UsersModule, EmailModule],
  controllers: [FareFreezeController],
  providers: [FareFreezeService],
  exports: [FareFreezeService],
})
export class FareFreezeModule {}
