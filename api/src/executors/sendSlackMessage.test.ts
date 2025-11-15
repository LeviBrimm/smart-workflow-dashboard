import assert from 'node:assert/strict';
import test from 'node:test';
import type { Response, RequestInit } from 'node-fetch';
import { sendSlackMessage } from './sendSlackMessage.js';

const okResponse = { ok: true } as Response;

test('sendSlackMessage throws when webhook missing', async () => {
  await assert.rejects(
    () => sendSlackMessage({ webhookUrl: '' }),
    /webhookUrl is required/
  );
});

test('sendSlackMessage throws when text and blocks missing', async () => {
  await assert.rejects(
    () => sendSlackMessage({ webhookUrl: 'https://hooks.slack.com/test' }),
    /requires text or blocks/
  );
});

test('sendSlackMessage posts payload to Slack', async () => {
  let called = false;
  const fetcher = async (url: string, init?: RequestInit) => {
    called = true;
    assert.equal(url, 'https://hooks.slack.com/test');
    assert.equal((init?.headers as Record<string, string>)['Content-Type'], 'application/json');
    const body = JSON.parse(init?.body as string);
    assert.equal(body.text, 'hello');
    return okResponse;
  };

  const result = await sendSlackMessage({ webhookUrl: 'https://hooks.slack.com/test', text: 'hello' }, fetcher);
  assert.equal(result.ok, true);
  assert.equal(called, true);
});

test('sendSlackMessage throws on non-200 response', async () => {
  const fetcher = async () =>
    ({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    } as Response);

  await assert.rejects(
    () => sendSlackMessage({ webhookUrl: 'https://hooks.slack.com/test', text: 'hello' }, fetcher),
    /Slack webhook error/
  );
});
