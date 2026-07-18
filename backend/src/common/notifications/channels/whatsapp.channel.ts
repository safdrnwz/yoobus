import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationContext } from '../notification-channel.interface';

/**
 * WhatsApp adapter. Disabled until a provider (e.g. WhatsApp Cloud API) token is set.
 * Same interface as email so adoption needs no caller changes.
 */
@Injectable()
export class WhatsappChannel implements NotificationChannel {
  readonly name = 'whatsapp';
  private readonly logger = new Logger('WhatsappChannel');
  constructor(private readonly config: ConfigService) {}
  isEnabled(): boolean {
    return this.config.get<boolean>('notify.whatsappEnabled') === true;
  }
  async send(
    to: string,
    template: string,
    _vars: Record<string, unknown>,
    _ctx: NotificationContext,
  ): Promise<{ channel: string; status: string }> {
    // Provider call goes here when enabled. For now we log in dev.
    this.logger.log(`[WHATSAPP DEV] to=${to} template=${template}`);
    return { channel: this.name, status: 'DEV' };
  }
}
