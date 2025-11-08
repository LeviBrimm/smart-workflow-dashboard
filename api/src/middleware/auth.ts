import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

const issuer = process.env.COGNITO_ISSUER;
const audience = process.env.COGNITO_CLIENT_ID;

if (!issuer) {
  console.warn('COGNITO_ISSUER is not defined; auth middleware will reject all requests.');
}

const jwks = issuer ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)) : null;
const skipAuth = process.env.SKIP_AUTH === 'true';
const devUserId = process.env.DEV_USER_ID ?? '00000000-0000-0000-0000-000000000000';
const devUserEmail = process.env.DEV_USER_EMAIL ?? 'local@example.com';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; email?: string; claims: JWTPayload };
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (skipAuth) {
      req.user = {
        id: devUserId,
        email: devUserEmail,
        claims: {},
      };
      return next();
    }

    if (!jwks) {
      throw new Error('JWK set not configured');
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing bearer token' });
    }

    const token = authHeader.replace('Bearer ', '');
    const verified = await jwtVerify(token, jwks, {
      issuer,
      audience,
    });

    const sub = verified.payload.sub;
    if (!sub) {
      return res.status(401).json({ message: 'Invalid token payload (missing sub)' });
    }

    req.user = {
      id: sub,
      email: typeof verified.payload.email === 'string' ? verified.payload.email : undefined,
      claims: verified.payload,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error', error);
    res.status(401).json({ message: 'Unauthorized' });
  }
};
