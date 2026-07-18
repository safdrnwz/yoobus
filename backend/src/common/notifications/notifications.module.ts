import { Global, Module } from '@nestjs/common';
import { EmailModule } from '../../modules/integrations/email/email.module';
import { NotificationService } from './notification.service';
import { EmailChannel } from './channels/email.channel';
import { WhatsappChannel } from './channels/whatsapp.channel';
import { SmsChannel } from './channels/sms.channel';

@Global()
@Module({
  imports: [EmailModule],
  providers: [NotificationService, EmailChannel, WhatsappChannel, SmsChannel],
  exports: [NotificationService],
})
export class NotificationsModule {}
