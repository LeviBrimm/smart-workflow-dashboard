import fetch from 'node-fetch';

export type HttpConfig = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

// Minimal executor used by local dry-runs to validate configs.
export const executeHttpRequest = async (config: HttpConfig, input: Record<string, unknown> = {}) => {
  const response = await fetch(config.url, {
    method: config.method ?? 'GET',
    headers: config.headers,
    body: config.body ? JSON.stringify(config.body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return {
    status: response.status,
    data: json,
    input,
  };
};
