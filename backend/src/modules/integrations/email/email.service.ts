import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { EmailLog } from './email-log.entity';
import { renderTemplate } from './templates';
import { isCrossOperatorLeak } from '../../../common/logic/email-recipient.util';
import { NotificationPolicyService } from '../../platform/notification-settings/notification-policy.service';

interface SendArgs {
  to: string;
  template: string;
  vars: Record<string, any>;
  // operatorId: the operator context for this mail. For passenger mail this is null.
  operatorId: string | null;
  // Safety guard: the recipient's operatorId (when the recipient is staff). If provided and
  // notification ke operatorId se mismatch => LEAK, block.
  recipientOperatorId?: string | null;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger('Email');
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(EmailLog) private readonly logRepo: Repository<EmailLog>,
    private readonly policy: NotificationPolicyService,
  ) {
    const user = this.config.get<string>('email.user');
    const pass = this.config.get<string>('email.pass');
    const devMode = this.config.get<boolean>('email.devMode');
    if (!devMode && user && pass) {
      const port = Number(this.config.get('email.port')) || 587;
      this.transporter = nodemailer.createTransport({
        host: this.config.get('email.host') || 'smtp.gmail.com',
        port,
        secure: port === 465,       // 465 = implicit TLS; 587 (Gmail) = STARTTLS
        requireTLS: port !== 465,   // enforce STARTTLS on 587 so the Gmail App Password is sent securely
        auth: { user, pass },       // Gmail App Password (from SMTP_USER / SMTP_PASS)
        // Without these, an unreachable SMTP host makes sendMail() hang on the OS default
        // TCP timeout (~2 minutes) — and because callers await it, the whole HTTP request
        // hangs with it. Approving an operator must not wait on a mail server.
        connectionTimeout: 5_000,
        greetingTimeout: 5_000,
        socketTimeout: 10_000,
      });
      // Non-blocking: report in the logs whether the SMTP credentials actually work, so a wrong
      // Gmail App Password is obvious at boot instead of silently failing on every send.
      this.transporter
        .verify()
        .then(() => this.logger.log(`SMTP ready — sending mail as ${user}`))
        .catch((e: any) =>
          this.logger.warn(
            `SMTP verify failed: ${e?.message}. Emails may not send — check SMTP_USER / SMTP_PASS (Gmail App Password) and that "Less secure"/App Passwords are enabled.`,
          ),
        );
    } else {
      this.logger.warn(
        'Email is in DEV mode (or SMTP creds missing): mail is logged, not sent. Set EMAIL_DEV_MODE=false with a valid SMTP_USER / SMTP_PASS to actually send.',
      );
    }
  }

  async send(args: SendArgs): Promise<{ status: string }> {
   try {
    // ---- OPERATOR ISOLATION GUARD ----
    // If this is operator-scoped mail and the recipient is staff of a DIFFERENT operator,
    // then do not send it at all. One operator's mail must never reach another.
    if (
      args.operatorId &&
      args.recipientOperatorId !== undefined &&
      args.recipientOperatorId !== null &&
      isCrossOperatorLeak(args.recipientOperatorId, args.operatorId)
    ) {
      this.logger.warn(`Blocked cross-operator email to ${args.to}`);
      await this.saveLog(args, 'BLOCKED', 'cross-operator leak prevented');
      return { status: 'BLOCKED' };
    }

    // ---- NOTIFICATION POLICY GATE (plan + operator toggles) ----
    // Optional notifications can be switched off by the plan (superadmin) or the operator.
    // Mandatory notifications and platform mail always pass.
    if (!(await this.policy.isAllowed(args.operatorId ?? null, args.template, 'EMAIL'))) {
      await this.saveLog(args, 'SUPPRESSED', 'disabled by plan/operator notification settings');
      return { status: 'SUPPRESSED' };
    }

    const { subject, html } = renderTemplate(args.template, args.vars);
    const devMode = this.config.get<boolean>('email.devMode');

    if (devMode || !this.transporter) {
      this.logger.log(`[DEV EMAIL] to=${args.to} op=${args.operatorId} tmpl=${args.template} subject="${subject}"`);
      await this.saveLog(args, 'DEV', undefined, subject);
      return { status: 'DEV' };
    }

    try {
      await this.transporter.sendMail({
        from: this.config.get('email.from'),
        to: args.to,
        subject,
        html,
      });
      await this.saveLog(args, 'SENT', undefined, subject);
      return { status: 'SENT' };
    } catch (e: any) {
      this.logger.error(`Email failed to ${args.to}: ${e.message}`);
      await this.saveLog(args, 'FAILED', e.message, subject);
      return { status: 'FAILED' };
    }
   } catch (e: any) {
      // Email is best-effort: a mail problem must NEVER break the operation that triggered it.
      this.logger.error(`Email pipeline error to ${args.to}: ${e?.message}`);
      try { await this.saveLog(args, 'ERROR', e?.message); } catch { /* ignore */ }
      return { status: 'ERROR' };
    }
  }

  private async saveLog(args: SendArgs, status: string, error?: string, subject?: string) {
    try {
      await this.logRepo.save(
        this.logRepo.create({
          toEmail: args.to,
          operatorId: args.operatorId,
          template: args.template,
          subject: subject ?? args.template,
          status,
          error,
        }),
      );
    } catch (e: any) {
      this.logger.error(`EmailLog save failed: ${e.message}`);
    }
  }
}
