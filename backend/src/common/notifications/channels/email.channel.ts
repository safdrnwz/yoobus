import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationContext } from '../notification-channel.interface';
import { EmailService } from '../../../modules/integrations/email/email.service';

/** Email channel — delegates to the existing, operator-isolated EmailService. */
@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly name = 'email';
  constructor(private readonly email: EmailService) {}
  isEnabled(): boolean {
    return true;
  }
  async send(
    to: string,
    template: string,
    vars: Record<string, unknown>,
    ctx: NotificationContext,
  ): Promise<{ channel: string; status: string }> {
    const res = await this.email.send({
      to,
      template,
      vars: vars as Record<string, any>,
      operatorId: ctx.operatorId,
      recipientOperatorId: ctx.recipientOperatorId,
    });
    return { channel: this.name, status: res.status };
  }
}
