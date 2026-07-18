import { MessagingModule } from '../../integrations/messaging/messaging.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { Otp } from './entities/otp.entity';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { UsersModule } from '../users/users.module';
@Module({
  imports: [MessagingModule, TypeOrmModule.forFeature([Otp]), UsersModule, JwtModule.register({}), ConfigModule],
  controllers: [OtpController], providers: [OtpService], exports: [OtpService],
})
export class OtpModule {}
