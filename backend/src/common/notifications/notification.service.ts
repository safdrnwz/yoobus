import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationContext } from './notification-channel.interface';
import { EmailChannel } from './channels/email.channel';
import { WhatsappChannel } from './channels/whatsapp.channel';
import { SmsChannel } from './channels/sms.channel';

/**
 * Unified notification dispatcher (Rule 049, 160, 162). Fans out to every enabled
 * channel. Email is always on; WhatsApp/SMS activate via config without code changes.
 */
@Injectable()
export class NotificationService {
  private readonly channels: NotificationChannel[];
  constructor(email: EmailChannel, whatsapp: WhatsappChannel, sms: SmsChannel) {
    this.channels = [email, whatsapp, sms];
  }

  async notify(
    to: string,
    template: string,
    vars: Record<string, unknown>,
    ctx: NotificationContext,
  ): Promise<Array<{ channel: string; status: string }>> {
    const enabled = this.channels.filter((c) => c.isEnabled());
    return Promise.all(enabled.map((c) => c.send(to, template, vars, ctx)));
  }
}
