import { useState } from 'react';

const apiBase = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

const CopyButton = ({ value, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for older browsers.
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('copy failed', error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs font-medium text-sky-400 hover:text-sky-200"
    >
      {copied ? 'Copied!' : label}
    </button>
  );
};

const TriggerItem = ({ trigger }) => {
  const webhookUrl = apiBase ? `${apiBase}/webhook/${trigger.id}` : `/v1/webhook/${trigger.id}`;
  const isWebhook = trigger.kind === 'webhook';
  const isSchedule = trigger.kind === 'schedule';
  const cronExpr = isSchedule ? trigger.config?.cron : null;

  return (
    <li className="rounded border border-slate-800/80 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium capitalize">{trigger.kind}</p>
        <CopyButton value={trigger.id} label="Copy ID" />
      </div>
      <p className="mt-1 break-all font-mono text-xs text-slate-400">ID: {trigger.id}</p>
      {isWebhook && (
        <div className="mt-2 space-y-1 text-xs">
          <p className="text-slate-400">Webhook URL:</p>
          <div className="flex items-center gap-2">
            <span className="break-all font-mono text-slate-300">{webhookUrl}</span>
            <CopyButton value={webhookUrl} label="Copy URL" />
          </div>
        </div>
      )}
      {isSchedule && cronExpr && (
        <p className="mt-2 text-xs text-slate-300">
          Cron: <span className="font-mono text-slate-200">{cronExpr}</span>
        </p>
      )}
      <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-900/40 p-2 text-xs text-slate-400">
        {JSON.stringify(trigger.config, null, 2)}
      </pre>
    </li>
  );
};

const TriggerList = ({ triggers = [] }) => (
  <div className="card">
    <h3 className="mb-3 text-lg font-semibold">Triggers</h3>
    {triggers.length ? (
      <ul className="space-y-3 text-sm">
        {triggers.map(trigger => (
          <TriggerItem key={trigger.id} trigger={trigger} />
        ))}
      </ul>
    ) : (
      <p className="text-sm text-slate-500">No triggers configured.</p>
    )}
  </div>
);

export default TriggerList;
