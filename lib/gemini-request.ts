import 'server-only';
import { setTimeout as delay } from 'node:timers/promises';

const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);
const REQUEST_BUDGET_MS = 65_000;
type Dependencies = {
  fetcher: typeof fetch;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  now: () => number;
  random: () => number;
};

/** Three attempts maximum, sharing one deadline. Never retry quota/auth/invalid output. */
export async function requestGemini(
  apiKey: string,
  primaryModel: string,
  fallbackModel: string,
  bodyForModel: (model: string) => string,
  dependencies: Partial<Dependencies> = {},
): Promise<Response> {
  const { fetcher, sleep, now, random }: Dependencies = {
    fetcher: fetch,
    sleep: async (ms, signal) => { await delay(ms, undefined, { signal }); },
    now: Date.now,
    random: Math.random,
    ...dependencies,
  };
  const deadline = now() + REQUEST_BUDGET_MS;
  const signal = AbortSignal.timeout(REQUEST_BUDGET_MS);
  const models = [primaryModel, primaryModel, fallbackModel || primaryModel];
  for (let attempt = 0; attempt < models.length; attempt++) {
    // One shared signal also covers response-body consumption and retry delays.
    signal.throwIfAborted();
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${models[attempt]}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal,
      body: bodyForModel(models[attempt]),
    });
    if (!TRANSIENT_STATUSES.has(response.status) || attempt === models.length - 1) return response;
    const header = response.headers.get('retry-after');
    const retryAfterMs = header === null ? NaN : /^\d+(\.\d+)?$/.test(header.trim())
      ? Number(header) * 1000
      : Date.parse(header) - now();
    const backoffMs = 1000 * 2 ** attempt + Math.floor(random() * 250);
    const waitMs = Number.isFinite(retryAfterMs) ? Math.max(backoffMs, retryAfterMs) : backoffMs;
    // Don't violate a long Retry-After header or start work beyond the total budget.
    if (now() + waitMs + 1000 >= deadline) return response;
    await response.body?.cancel();
    await sleep(waitMs, signal);
  }
  throw new Error('Gemini request attempts exhausted');
}
