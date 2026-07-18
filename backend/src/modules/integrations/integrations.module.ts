import { Module } from '@nestjs/common';
import { OtaModule } from './ota/ota.module';
import { NotificationsQueryModule } from './notifications/notifications-query.module';
import { MessagingModule } from './messaging/messaging.module';
import { ChannelsModule } from './channels/channels.module';
import { EmailModule } from './email/email.module';
import { UploadsModule } from './uploads/uploads.module';

/** Integrations domain barrel — aggregates all integrations feature modules. */
@Module({
  imports: [OtaModule, NotificationsQueryModule, MessagingModule, ChannelsModule, EmailModule, UploadsModule],
  exports: [OtaModule, NotificationsQueryModule, MessagingModule, ChannelsModule, EmailModule, UploadsModule],
})
export class IntegrationsModule {}
