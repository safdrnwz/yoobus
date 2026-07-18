import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationContext } from '../notification-channel.interface';

/** SMS adapter. Disabled until an SMS gateway (e.g. provider DLT) is configured. */
@Injectable()
export class SmsChannel implements NotificationChannel {
  readonly name = 'sms';
  private readonly logger = new Logger('SmsChannel');
  constructor(private readonly config: ConfigService) {}
  isEnabled(): boolean {
    return this.config.get<boolean>('notify.smsEnabled') === true;
  }
  async send(
    to: string,
    template: string,
    _vars: Record<string, unknown>,
    _ctx: NotificationContext,
  ): Promise<{ channel: string; status: string }> {
    this.logger.log(`[SMS DEV] to=${to} template=${template}`);
    return { channel: this.name, status: 'DEV' };
  }
}
