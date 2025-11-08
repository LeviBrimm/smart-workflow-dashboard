import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTemplates } from './templates.js';

const ctx = {
  runId: 'run-123',
  userId: 'user-1',
  steps: {
    step_0: { status: 200, body: { message: 'ok' } },
  },
  input: { payload: { foo: 'bar' } },
};

test('resolveTemplates replaces simple placeholders', () => {
  const result = resolveTemplates('runs/{{ runId }}.json', ctx);
  assert.equal(result, 'runs/run-123.json');
});

test('resolveTemplates replaces nested values', () => {
  const result = resolveTemplates(
    {
      key: 'runs/{{runId}}.json',
      body: {
        message: '{{steps.step_0.body.message}}',
        foo: '{{input.payload.foo}}',
      },
    },
    ctx
  );
  assert.deepEqual(result, {
    key: 'runs/run-123.json',
    body: { message: 'ok', foo: 'bar' },
  });
});

test('resolveTemplates handles arrays and missing paths', () => {
  const result = resolveTemplates(['{{runId}}', '{{unknown.value}}'], ctx);
  assert.deepEqual(result, ['run-123', '']);
});
