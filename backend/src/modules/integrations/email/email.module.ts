import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationSettingsModule } from '../../platform/notification-settings/notification-settings.module';
import { EmailLog } from './email-log.entity';
import { EmailService } from './email.service';

/**
 * EmailService injects NotificationPolicyService (it asks the policy whether a given
 * notification is allowed to go out before sending). That provider is exported by
 * NotificationSettingsModule, so this module MUST import it — without the import Nest
 * cannot resolve EmailService and the whole application fails to boot.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([EmailLog]), NotificationSettingsModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
