import assert from 'node:assert/strict';
import test from 'node:test';
import type { Response } from 'node-fetch';
import { generateAIContent } from './generateAIContent.js';

const originalKey = process.env.OPENAI_API_KEY;

test('generateAIContent requires prompt', async () => {
  await assert.rejects(() => generateAIContent({ prompt: '' }), /requires a prompt/);
});

test('generateAIContent requires API key', async () => {
  delete process.env.OPENAI_API_KEY;
  await assert.rejects(() => generateAIContent({ prompt: 'hi' }), /OPENAI_API_KEY/);
});

test('generateAIContent returns text on success', async () => {
  process.env.OPENAI_API_KEY = 'test-key';

  const fetcher = async () =>
    ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello world' } }],
      }),
    } as Response);

  const result = await generateAIContent({ prompt: 'Say hi' }, fetcher);
  assert.equal(result.text, 'Hello world');
});

test('generateAIContent surfaces OpenAI errors', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const fetcher = async () =>
    ({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'boom' } }),
    } as Response);

  await assert.rejects(() => generateAIContent({ prompt: 'Say hi' }, fetcher), /boom/);
});

test.after(() => {
  process.env.OPENAI_API_KEY = originalKey;
});
