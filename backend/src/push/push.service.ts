import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly EXPO_PUSH_URL = 'https://exp.host/push/send';

  constructor(private prisma: PrismaService) {}

  // ── M23.3 Register device token ──────────────────────────────────────────────

  async registerToken(userId: string, tenantId: string, token: string, platform: string) {
    await this.prisma.deviceToken.upsert({
      where: { token },
      update: { userId, tenantId, platform, isActive: true },
      create: { userId, tenantId, token, platform },
    });
    return { registered: true };
  }

  // ── M23.3 Deregister device token (on logout) ────────────────────────────────

  async deregisterToken(userId: string, token: string) {
    await this.prisma.deviceToken.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });
    return { deregistered: true };
  }

  // ── Send push to all active devices of specific users ─────────────────────────

  async sendPushToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    if (userIds.length === 0) return;

    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { token: true },
    });

    const validTokens = tokens
      .map((t) => t.token)
      .filter((t) => t.startsWith('ExponentPushToken['));

    if (validTokens.length === 0) return;

    const messages = validTokens.map((token) => ({
      to: token,
      title,
      body,
      data: data ?? {},
      sound: 'default',
      priority: 'high',
    }));

    // Expo accepts batches of up to 100
    const chunks: typeof messages[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      await this.httpPost(this.EXPO_PUSH_URL, chunk).catch((err) => {
        this.logger.warn(`Push send failed: ${err.message}`);
      });
    }

    this.logger.log(`Push sent to ${validTokens.length} device(s): ${title}`);
  }

  private httpPost(url: string, body: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const urlObj = new URL(url);
      const req = https.request(
        {
          hostname: urlObj.hostname,
          path: urlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          res.resume(); // drain
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Expo push HTTP ${res.statusCode}`));
          } else {
            resolve();
          }
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}
