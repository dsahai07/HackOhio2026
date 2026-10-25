import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestGemini } from '../lib/gemini-request';

function harness(statuses: number[], retryAfter?: string) {
  const urls: string[] = []; const waits: number[] = []; const signals: AbortSignal[] = [];
  let time = 0;
  const dependencies = {
    fetcher: (async (url, init) => {
      urls.push(String(url)); signals.push(init!.signal as AbortSignal);
      return new Response('{}', { status: statuses[Math.min(urls.length - 1, statuses.length - 1)], headers: retryAfter ? { 'Retry-After': retryAfter } : {} });
    }) as typeof fetch,
    sleep: async (ms: number) => { waits.push(ms); time += ms; },
    now: () => time,
    random: () => 0,
  };
  return { urls, waits, signals, dependencies };
}

test('503 recovers on primary retry with backoff and a shared timeout', async () => {
  const h = harness([503, 200]);
  const response = await requestGemini('fake-test-key', 'primary', 'fallback', () => '{}', h.dependencies);
  assert.equal(response.status, 200); assert.equal(h.urls.length, 2);
  assert.ok(h.urls.every(u => u.includes('/primary:'))); assert.deepEqual(h.waits, [1000]);
  assert.equal(h.signals[0], h.signals[1]);
});
test('two temporary failures switch to fallback on the final attempt', async () => {
  const h = harness([503, 502, 200]); const bodies: string[] = [];
  const response = await requestGemini('fake-test-key', 'primary', 'fallback', model => { bodies.push(model); return '{}'; }, h.dependencies);
  assert.equal(response.status, 200); assert.deepEqual(bodies, ['primary', 'primary', 'fallback']);
  assert.ok(h.urls[2].includes('/fallback:')); assert.deepEqual(h.waits, [1000, 2000]);
});
test('persistent provider outage stops after three attempts', async () => {
  const h = harness([503]);
  const response = await requestGemini('fake-test-key', 'primary', 'fallback', () => '{}', h.dependencies);
  assert.equal(response.status, 503); assert.equal(h.urls.length, 3);
});
test('quota, authentication, bad requests, and unavailable models are not retried', async () => {
  for (const status of [400, 401, 403, 404, 429]) {
    const h = harness([status]);
    assert.equal((await requestGemini('fake-test-key', 'primary', 'fallback', () => '{}', h.dependencies)).status, status);
    assert.equal(h.urls.length, 1); assert.equal(h.waits.length, 0);
  }
});
test('honors Retry-After without exceeding the shared time budget', async () => {
  const short = harness([503, 200], '5');
  await requestGemini('fake-test-key', 'primary', 'fallback', () => '{}', short.dependencies);
  assert.deepEqual(short.waits, [5000]);
  const long = harness([503], '120');
  assert.equal((await requestGemini('fake-test-key', 'primary', 'fallback', () => '{}', long.dependencies)).status, 503);
  assert.equal(long.urls.length, 1); assert.equal(long.waits.length, 0);
});
test('empty fallback keeps all attempts on the configured primary', async () => {
  const h = harness([503, 503, 200]);
  await requestGemini('fake-test-key', 'primary', '', () => '{}', h.dependencies);
  assert.ok(h.urls.every(u => u.includes('/primary:')));
});
