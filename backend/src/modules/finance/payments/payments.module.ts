import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../../customer/users/users.module';
import { EmailModule } from '../../integrations/email/email.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { BookingsModule } from '../../booking/bookings/bookings.module';
@Module({
  imports: [TypeOrmModule.forFeature([Payment]), BookingsModule, ConfigModule, UsersModule, EmailModule],
  controllers: [PaymentsController], providers: [PaymentsService],
})
export class PaymentsModule {}
