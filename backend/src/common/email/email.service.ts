import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private fromAddress: string;

  constructor(private config: ConfigService) {
    const isDev = config.get('NODE_ENV') !== 'production';
    this.fromAddress = config.get('EMAIL_FROM', 'noreply@restrocloud.app');

    if (isDev && !config.get('SMTP_HOST')) {
      // Console transport — logs emails to stdout instead of sending
      this.transporter = nodemailer.createTransport({ jsonTransport: true } as any);
      this.logger.log('Email service: DEV mode (emails logged to console, not sent)');
    } else {
      this.transporter = nodemailer.createTransport({
        host: config.get('SMTP_HOST'),
        port: config.getOrThrow<number>('SMTP_PORT'),
        secure: config.get('SMTP_SECURE') === 'true',
        auth: {
          user: config.get('SMTP_USER'),
          pass: config.get('SMTP_PASS'),
        },
      });
    }
  }

  async sendMail(opts: { to: string; subject: string; html: string; text?: string }) {
    const msg = { from: this.fromAddress, ...opts };
    try {
      const info = await this.transporter.sendMail(msg);
      // In dev (jsonTransport), info.message is the stringified email JSON
      if ((info as any).message) {
        const parsed = JSON.parse((info as any).message);
        this.logger.log(`[EMAIL] To: ${opts.to} | Subject: ${opts.subject}`);
        this.logger.debug(`[EMAIL BODY]: ${opts.html}`);
      } else {
        this.logger.log(`Email sent to ${opts.to} — messageId: ${info.messageId}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${err.message}`);
      throw err;
    }
  }

  async sendVerificationEmail(to: string, firstName: string, token: string) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3001');
    const link = `${frontendUrl}/verify-email?token=${token}`;
    await this.sendMail({
      to,
      subject: 'Verify your RestroCloud email',
      html: `
        <h2>Welcome to RestroCloud, ${firstName}!</h2>
        <p>Please verify your email address by clicking the button below.</p>
        <p><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Verify Email</a></p>
        <p>Or copy this link: <code>${link}</code></p>
        <p>This link expires in 24 hours.</p>
      `,
      text: `Verify your email: ${link}`,
    });
  }

  async sendPasswordResetEmail(to: string, firstName: string, token: string) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3001');
    const link = `${frontendUrl}/reset-password?token=${token}`;
    await this.sendMail({
      to,
      subject: 'Reset your RestroCloud password',
      html: `
        <h2>Hi ${firstName},</h2>
        <p>We received a request to reset your password.</p>
        <p><a href="${link}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Reset Password</a></p>
        <p>Or copy this link: <code>${link}</code></p>
        <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      `,
      text: `Reset your password: ${link}`,
    });
  }

  async sendOwnerWelcomeEmail(
    to: string,
    firstName: string,
    restaurantName: string,
    tempPassword: string,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3001');
    await this.sendMail({
      to,
      subject: `Welcome to RestroCloud — Your account is ready`,
      html: `
        <h2>Welcome to RestroCloud, ${firstName}!</h2>
        <p>Your restaurant account for <strong>${restaurantName}</strong> has been created by our team.</p>
        <h3 style="margin-top:24px;">Your Login Credentials</h3>
        <table style="border-collapse:collapse;margin:12px 0;">
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f3f4f6;">Login URL</td><td style="padding:6px 12px;"><a href="${frontendUrl}/login">${frontendUrl}/login</a></td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f3f4f6;">Email</td><td style="padding:6px 12px;">${to}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f3f4f6;">Temporary Password</td><td style="padding:6px 12px;font-family:monospace;font-size:16px;letter-spacing:2px;">${tempPassword}</td></tr>
        </table>
        <p style="color:#dc2626;font-weight:bold;">Please change your password immediately after your first login.</p>
        <p>If you have any questions, reply to this email or contact our support team.</p>
        <p>— The RestroCloud Team</p>
      `,
      text: `Welcome to RestroCloud, ${firstName}! Login at ${frontendUrl}/login. Email: ${to}. Temporary password: ${tempPassword}. Please change your password after first login.`,
    });
  }

  async sendStaffWelcomeEmail(
    to: string,
    firstName: string,
    restaurantName: string,
    tempPassword: string,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3001');
    await this.sendMail({
      to,
      subject: `You've been added to ${restaurantName} on RestroCloud`,
      html: `
        <h2>Welcome, ${firstName}!</h2>
        <p>You've been added as a staff member at <strong>${restaurantName}</strong>.</p>
        <p>Login at <a href="${frontendUrl}/login">${frontendUrl}/login</a></p>
        <p>Temporary password: <code>${tempPassword}</code></p>
        <p>Please change your password after first login.</p>
      `,
      text: `You've been added to ${restaurantName}. Login at ${frontendUrl}/login. Temporary password: ${tempPassword}`,
    });
  }
}
