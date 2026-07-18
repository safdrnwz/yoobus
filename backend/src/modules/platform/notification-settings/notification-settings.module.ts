import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorNotificationPreference } from './entities/notification-settings.entities';
import { NotificationPolicyService } from './notification-policy.service';
import { NotificationSettingsController } from './notification-settings.controller';

/** Global so EmailService / MessagingService can gate on it without import cycles. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OperatorNotificationPreference])],
  controllers: [NotificationSettingsController],
  providers: [NotificationPolicyService],
  exports: [NotificationPolicyService],
})
export class NotificationSettingsModule {}
