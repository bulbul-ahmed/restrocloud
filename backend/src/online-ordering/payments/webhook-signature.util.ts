import * as crypto from 'crypto';

/**
 * Verify an HMAC-SHA256 webhook signature.
 * Expected header format: `sha256=<hex-digest>`
 */
export function verifyWebhookSignature(
  rawPayload: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(rawPayload)
    .digest('hex')}`;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signatureHeader, 'utf8'),
    );
  } catch {
    return false;
  }
}

/** Generate a mock webhook signature for testing */
export function generateMockSignature(payload: string, secret: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}
