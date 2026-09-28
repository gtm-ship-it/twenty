import { createHmac, timingSafeEqual } from 'crypto';

const TOLERANCE_SECONDS = 5 * 60;

// Fathom firma como Standard Webhooks: HMAC-SHA256(base64(secret sin "whsec_"))
// sobre `${webhook-id}.${webhook-timestamp}.${rawBody}`; el header trae una o
// varias firmas "v1,<base64>" separadas por espacios.
export const verifyFathomSignature = ({
  secret,
  webhookId,
  webhookTimestamp,
  webhookSignature,
  rawBody,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  secret: string;
  webhookId: string | undefined;
  webhookTimestamp: string | undefined;
  webhookSignature: string | undefined;
  rawBody: Buffer | string;
  nowSeconds?: number;
}): boolean => {
  if (!webhookId || !webhookTimestamp || !webhookSignature || !secret) {
    return false;
  }

  const timestamp = Number(webhookTimestamp);

  if (
    !Number.isFinite(timestamp) ||
    Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS
  ) {
    return false;
  }

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = createHmac('sha256', secretBytes)
    .update(`${webhookId}.${webhookTimestamp}.${body}`)
    .digest();

  return webhookSignature
    .split(' ')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith('v1,'))
    .some((entry) => {
      const candidate = Buffer.from(entry.slice(3), 'base64');

      return (
        candidate.length === expected.length &&
        timingSafeEqual(candidate, expected)
      );
    });
};
