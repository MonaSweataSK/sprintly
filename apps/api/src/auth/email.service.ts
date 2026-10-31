import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter?: Transporter;
  private readonly from?: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const port = config.get<number>('SMTP_PORT');
    const secure = config.get<boolean>('SMTP_SECURE');
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');
    const from = config.get<string>('SMTP_FROM');
    const anyConfigured = [host, user, password, from].some(Boolean);

    if (!anyConfigured) {
      return;
    }

    if (!host || !port || !from || Boolean(user) !== Boolean(password)) {
      throw new Error(
        'Configure SMTP_HOST, SMTP_PORT, and SMTP_FROM; SMTP_USER and SMTP_PASSWORD must be provided together.',
      );
    }

    this.from = from;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });
  }

  assertConfigured(): void {
    if (!this.transporter || !this.from) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Configure SMTP before requesting a sign-in code.',
      );
    }
  }

  async sendOtp(email: string, code: string): Promise<void> {
    this.assertConfigured();

    try {
      await this.transporter!.sendMail({
        from: this.from,
        to: email,
        subject: 'Your Sprintly sign-in code',
        text: `Your Sprintly verification code is ${code}. It expires in 5 minutes. If you did not request this code, you can ignore this email.`,
      });
    } catch (error) {
      this.logger.error(
        'Failed to deliver sign-in code',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'We could not deliver a sign-in code right now. Please try again later.',
      );
    }
  }
}
