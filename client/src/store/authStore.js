import { create } from 'zustand';

const domain = import.meta.env.VITE_COGNITO_DOMAIN;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;
const apiBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/v1';
const storageKey = 'swd.auth';

const loginUrl =
  domain && clientId && redirectUri
    ? `${domain}/login?client_id=${clientId}&response_type=code&scope=email+openid+profile&redirect_uri=${encodeURIComponent(
        redirectUri
      )}`
    : '#';

const decodeJwt = token => {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const readStoredSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const persistSession = session => {
  if (typeof window === 'undefined') return;
  if (session) {
    window.localStorage.setItem(storageKey, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(storageKey);
  }
};

export const useAuthStore = create((set, get) => ({
  user: null,
  tokens: null,
  loginUrl,
  isHydrated: false,
  setSession: ({ user, tokens }) => {
    if (!tokens?.idToken) {
      throw new Error('Missing id token');
    }
    const claims = decodeJwt(tokens.idToken);
    const expiresAt = claims?.exp ? claims.exp * 1000 : undefined;
    const session = {
      user,
      tokens: {
        idToken: tokens.idToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
      },
    };
    persistSession(session);
    set(session);
  },
  hydrate: async () => {
    const stored = readStoredSession();
    if (stored?.tokens?.idToken) {
      set({ user: stored.user, tokens: stored.tokens, isHydrated: true });
      const now = Date.now();
      if (stored.tokens.expiresAt && stored.tokens.expiresAt - now < 60_000) {
        await get().refreshSession().catch(() => get().logout());
      }
    } else {
      set({ isHydrated: true });
    }
  },
  refreshSession: async () => {
    const refreshToken = get().tokens?.refreshToken;
    if (!refreshToken) {
      throw new Error('Missing refresh token');
    }
    const response = await fetch(`${apiBase}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      throw new Error('Refresh failed');
    }
    const data = await response.json();
    const tokens = {
      idToken: data.tokens?.id_token,
      accessToken: data.tokens?.access_token,
      refreshToken: data.tokens?.refresh_token ?? refreshToken,
    };
    const user = data.user ?? get().user;
    get().setSession({ user, tokens });
    return tokens;
  },
  logout: () => {
    persistSession(null);
    set({ user: null, tokens: null });
  },
}));
