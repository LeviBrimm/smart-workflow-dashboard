import test from 'node:test';
import assert from 'node:assert/strict';
import { isDue } from './cron.js';

test('isDue returns true when cron matches current minute', () => {
  const reference = new Date('2025-01-01T10:02:30Z');
  assert.equal(isDue('*/2 * * * *', reference), true);
});

test('isDue returns false when cron does not match', () => {
  const reference = new Date('2025-01-01T10:03:30Z');
  assert.equal(isDue('*/2 * * * *', reference), false);
});

test('isDue returns false for invalid expression', () => {
  const warn = console.warn;
  console.warn = () => {};
  assert.equal(isDue('invalid', new Date()), false);
  console.warn = warn;
});
