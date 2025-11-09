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
      className="text-xs font-medium text-[#8c5a3c] hover:text-[#6a4229]"
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
    <li className="rounded-2xl border border-[#e0d4c6] bg-white/90 px-3 py-2 text-sm text-[#1f1c1a] shadow-inner">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium capitalize text-[#1f1c1a]">{trigger.kind}</p>
        <CopyButton value={trigger.id} label="Copy ID" />
      </div>
      <p className="mt-1 break-all font-mono text-xs text-[#7a6a5d]">ID: {trigger.id}</p>
      {isWebhook && (
        <div className="mt-2 space-y-1 text-xs">
          <p className="text-[#7a6a5d]">Webhook URL:</p>
          <div className="flex items-center gap-2">
            <span className="break-all font-mono text-[#5c3d2e]">{webhookUrl}</span>
            <CopyButton value={webhookUrl} label="Copy URL" />
          </div>
        </div>
      )}
      {isSchedule && cronExpr && (
        <p className="mt-2 text-xs text-[#7a6a5d]">
          Cron: <span className="font-mono text-[#5c3d2e]">{cronExpr}</span>
        </p>
      )}
      <pre className="mt-2 whitespace-pre-wrap rounded bg-[#f7f1ea] p-2 text-xs text-[#5c3d2e]">
        {JSON.stringify(trigger.config, null, 2)}
      </pre>
    </li>
  );
};

const TriggerList = ({ triggers = [] }) => (
  <div className="card bg-white text-[#1f1c1a]">
    <h3 className="mb-3 text-lg font-semibold">Triggers</h3>
    {triggers.length ? (
      <ul className="space-y-3 text-sm">
        {triggers.map(trigger => (
          <TriggerItem key={trigger.id} trigger={trigger} />
        ))}
      </ul>
    ) : (
      <p className="text-sm text-[#7a6a5d]">No triggers configured.</p>
    )}
  </div>
);

export default TriggerList;
