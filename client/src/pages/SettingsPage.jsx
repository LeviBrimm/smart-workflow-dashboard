import { useAuthStore } from '../store/authStore.js';

const SettingsPage = () => {
  const { loginUrl } = useAuthStore();
  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm uppercase tracking-wide text-slate-400">Settings</p>
        <h1 className="text-2xl font-semibold">Developer Access</h1>
      </header>
      <div className="card space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-300">Webhook URL</p>
          <p className="text-xs text-slate-500">https://api.example.com/v1/webhook/your-trigger-id</p>
          <button className="btn-primary mt-2" onClick={() => navigator.clipboard.writeText('https://api.example.com/v1/webhook/...')}>
            Copy URL
          </button>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-300">Cognito Hosted UI</p>
          <a className="btn-primary" href={loginUrl}>
            Open Login Page
          </a>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
