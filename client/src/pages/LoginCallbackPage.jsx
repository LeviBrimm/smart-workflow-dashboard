import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

const apiBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/v1';

const LoginCallbackPage = () => {
  const [params] = useSearchParams();
  const code = params.get('code');
  const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;
  const navigate = useNavigate();
  const setSession = useAuthStore(state => state.setSession);

  useEffect(() => {
    const exchangeCode = async () => {
      if (!code) return;
      try {
        const response = await axios.post(`${apiBase}/auth/callback`, { code, redirectUri });
        setSession({
          user: response.data.user,
          tokens: {
            idToken: response.data.tokens?.id_token,
            accessToken: response.data.tokens?.access_token,
            refreshToken: response.data.tokens?.refresh_token,
          },
        });
        navigate('/workflows');
      } catch (error) {
        console.error('Login callback failed', error);
        const params = new URLSearchParams({
          client_id: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
          response_type: 'code',
          scope: 'email openid profile',
          redirect_uri: redirectUri ?? '',
        });
        window.location.href = `${import.meta.env.VITE_COGNITO_DOMAIN}/login?${params.toString()}`;
      }
    };
    exchangeCode();
  }, [code, navigate, redirectUri, setSession]);

  return <p className="text-center text-slate-400">Completing login…</p>;
};

export default LoginCallbackPage;
