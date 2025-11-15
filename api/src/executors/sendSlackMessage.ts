import fetch, { type Response, type RequestInit } from 'node-fetch';

export interface SlackConfig {
  webhookUrl: string;
  text?: string;
  blocks?: unknown;
  username?: string;
  iconEmoji?: string;
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export const sendSlackMessage = async (config: SlackConfig, fetcher: Fetcher = fetch): Promise<{ ok: boolean }> => {
  if (!config?.webhookUrl || typeof config.webhookUrl !== 'string') {
    throw new Error('Slack webhookUrl is required');
  }

  if (!config.text && !config.blocks) {
    throw new Error('Slack message requires text or blocks');
  }

  const payload: Record<string, unknown> = {
    text: config.text,
    blocks: config.blocks,
  };

  if (config.username) {
    payload.username = config.username;
  }

  if (config.iconEmoji) {
    payload.icon_emoji = config.iconEmoji;
  }

  const response = await fetcher(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Slack webhook error (${response.status}): ${body}`);
  }

  return { ok: true };
};
