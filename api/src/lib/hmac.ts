import crypto from 'node:crypto';

export const createSignature = (payload: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

export const verifySignature = (payload: string, secret: string, signature: string) => {
  const expected = createSignature(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};
