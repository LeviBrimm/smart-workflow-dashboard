import { Router } from 'express';
import fetch from 'node-fetch';
import { syncCognitoUser } from '../services/user.service.js';

const router = Router();

const cognitoDomain = process.env.COGNITO_DOMAIN;
const cognitoClientId = process.env.COGNITO_CLIENT_ID;
const cognitoClientSecret = process.env.COGNITO_CLIENT_SECRET;

const decodeJwtPayload = (token: string) => {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid JWT structure');
  }
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json);
};

router.post('/callback', async (req, res) => {
  try {
    if (!cognitoDomain || !cognitoClientId) {
      return res.status(500).json({ message: 'Cognito configuration unavailable' });
    }

    const { code, redirectUri } = req.body as { code?: string; redirectUri?: string };
    if (!code || !redirectUri) {
      return res.status(400).json({ message: 'Missing authorization code or redirect URI' });
    }

    const tokenEndpoint = `${cognitoDomain}/oauth2/token`;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cognitoClientId,
      code,
      redirect_uri: redirectUri,
    });

    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (cognitoClientSecret) {
      const basicAuth = Buffer.from(`${cognitoClientId}:${cognitoClientSecret}`).toString('base64');
      headers.Authorization = `Basic ${basicAuth}`;
    }

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers,
      body: params,
    });

    const tokens = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      token_type?: string;
      expires_in?: number;
    };
    if (!response.ok) {
      return res.status(response.status).json({ message: 'Failed to exchange code', details: tokens });
    }

    if (!tokens.id_token) {
      return res.status(502).json({ message: 'Cognito response missing id_token' });
    }

    const claims = decodeJwtPayload(tokens.id_token);

    const user = {
      id: claims.sub as string,
      email: claims.email as string | undefined,
      givenName: claims.given_name as string | undefined,
      familyName: claims.family_name as string | undefined,
    };

    await syncCognitoUser({ id: user.id, email: user.email, cognitoSub: claims.sub as string });

    res.json({ tokens, user });
  } catch (error) {
    console.error('Auth callback error', error);
    res.status(500).json({ message: 'Unable to complete login' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    if (!cognitoDomain || !cognitoClientId) {
      return res.status(500).json({ message: 'Cognito configuration unavailable' });
    }

    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      return res.status(400).json({ message: 'Missing refresh token' });
    }

    const tokenEndpoint = `${cognitoDomain}/oauth2/token`;
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: cognitoClientId,
      refresh_token: refreshToken,
    });

    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (cognitoClientSecret) {
      const basicAuth = Buffer.from(`${cognitoClientId}:${cognitoClientSecret}`).toString('base64');
      headers.Authorization = `Basic ${basicAuth}`;
    }

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers,
      body: params,
    });

    const tokens = (await response.json()) as {
      id_token?: string;
      access_token?: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
    };

    if (!response.ok) {
      return res.status(response.status).json({ message: 'Failed to refresh tokens', details: tokens });
    }

    if (!tokens.id_token) {
      return res.status(502).json({ message: 'Cognito refresh response missing id_token' });
    }

    const claims = decodeJwtPayload(tokens.id_token);
    const user = {
      id: claims.sub as string,
      email: claims.email as string | undefined,
      givenName: claims.given_name as string | undefined,
      familyName: claims.family_name as string | undefined,
    };

    await syncCognitoUser({ id: user.id, email: user.email, cognitoSub: claims.sub as string });

    res.json({ tokens, user });
  } catch (error) {
    console.error('Auth refresh error', error);
    res.status(500).json({ message: 'Unable to refresh session' });
  }
});

export default router;
