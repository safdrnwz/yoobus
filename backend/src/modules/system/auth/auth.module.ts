import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../../customer/users/users.module';
import { OtpModule } from '../../customer/otp/otp.module';
import { EmailModule } from '../../integrations/email/email.module';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { KnownDevice } from './entities/known-device.entity';
import { LoginAttempt } from './entities/login-attempt.entity';
import { AuditModule } from '../../platform/audit/audit.module';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    OtpModule,
    EmailModule,
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    TypeOrmModule.forFeature([PasswordResetToken, RefreshToken, LoginAttempt, EmailVerificationToken, KnownDevice]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
