import fetch, { type Response, type RequestInit } from 'node-fetch';

export interface AIContentConfig {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_MODEL = 'gpt-4o-mini';

export const generateAIContent = async (
  config: AIContentConfig & { apiKey?: string },
  fetcher: Fetcher = fetch
): Promise<{ text: string }> => {
  if (!config?.prompt || typeof config.prompt !== 'string') {
    throw new Error('AI step requires a prompt string');
  }

  const apiKey = typeof config.apiKey === 'string' && config.apiKey.length ? config.apiKey : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const body = {
    model: config.model ?? DEFAULT_MODEL,
    temperature: typeof config.temperature === 'number' ? config.temperature : 0.2,
    max_tokens: typeof config.maxTokens === 'number' ? config.maxTokens : undefined,
    messages: [
      config.systemPrompt
        ? { role: 'system' as const, content: config.systemPrompt }
        : null,
      { role: 'user' as const, content: config.prompt },
    ].filter(Boolean),
  };

  const response = await fetcher('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message ?? `OpenAI error (${response.status})`);
  }

  const text = data.choices?.[0]?.message?.content ?? '';
  return { text };
};
