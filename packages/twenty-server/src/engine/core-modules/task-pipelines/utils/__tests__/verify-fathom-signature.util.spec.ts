import { createHmac } from 'crypto';

import { verifyFathomSignature } from 'src/engine/core-modules/task-pipelines/utils/verify-fathom-signature.util';

const secretBytes = Buffer.from('super-secret-key-bytes');
const secret = `whsec_${secretBytes.toString('base64')}`;
const body = '{"recording_id":123}';
const sign = (id: string, ts: string, payload: string) =>
  `v1,${createHmac('sha256', secretBytes).update(`${id}.${ts}.${payload}`).digest('base64')}`;

describe('verifyFathomSignature', () => {
  const now = 1_800_000_000;
  const ts = String(now);

  it('accepts a valid signature', () => {
    expect(
      verifyFathomSignature({ secret, webhookId: 'msg_1', webhookTimestamp: ts, webhookSignature: sign('msg_1', ts, body), rawBody: Buffer.from(body), nowSeconds: now }),
    ).toBe(true);
  });

  it('accepts when one of several signatures matches', () => {
    expect(
      verifyFathomSignature({ secret, webhookId: 'msg_1', webhookTimestamp: ts, webhookSignature: `v1,AAAA ${sign('msg_1', ts, body)}`, rawBody: body, nowSeconds: now }),
    ).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(
      verifyFathomSignature({ secret, webhookId: 'msg_1', webhookTimestamp: ts, webhookSignature: sign('msg_1', ts, body), rawBody: '{"recording_id":999}', nowSeconds: now }),
    ).toBe(false);
  });

  it('rejects an old timestamp', () => {
    expect(
      verifyFathomSignature({ secret, webhookId: 'msg_1', webhookTimestamp: ts, webhookSignature: sign('msg_1', ts, body), rawBody: body, nowSeconds: now + 3600 }),
    ).toBe(false);
  });

  it('rejects missing headers', () => {
    expect(
      verifyFathomSignature({ secret, webhookId: undefined, webhookTimestamp: ts, webhookSignature: 'v1,x', rawBody: body, nowSeconds: now }),
    ).toBe(false);
  });
});
