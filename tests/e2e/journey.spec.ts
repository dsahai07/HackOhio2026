import { test, expect } from '@playwright/test';

test('complete CS demo: diagnose, resume, hint, retry, six levels, compare, clear', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /your next aha/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/bloom-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Try the CS demo' }).click();
  await expect(page.getByText('Built-in content · No Gemini calls')).toBeVisible();
  await page.getByRole('button', { name: 'Take the 6-question diagnostic' }).click();
  const initial = [1, 0, 0, 3, 0, 3]; // Intentionally miss binary search to test personalization.
  for (let i = 0; i < initial.length; i++) await page.locator(`input[name="d${i + 1}"]`).nth(initial[i]).check();
  await page.reload();
  await page.getByRole('button', { name: 'Resume session' }).click();
  await expect(page.getByText('6 of 6 answered')).toBeVisible();
  await page.getByRole('button', { name: 'Build my learning path' }).click();
  await expect(page.getByText(/Your starting score is 67%/)).toBeVisible();
  await expect(page.getByText('1. Binary search', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start personalized learning' }).click();
  for (let i = 0; i < 6; i++) {
    await expect(page.getByText(`Task ${i + 1} of 6`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View worked example' })).toHaveCount(0);
    if (i === 0) {
      await page.getByRole('button', { name: 'A little hint' }).click();
      await expect(page.locator('.hint-box')).toBeVisible();
    }
    const demoAnswers = [
      'The data must be sorted. Binary search halves the interval, giving O(log n) time. Use low = mid + 1 for progress.',
      'Binary search uses sorted order to discard half of the remaining candidates at each step.',
      '12 and 22 collide in bucket 2, while 35 maps to bucket 5.',
      'Arrays provide O(1) constant time indexed access, while linked lists require O(n) linear traversal to follow links.',
      'Big O describes asymptotic growth, not always exact runtime. Small input sizes and constants can make O(n^2) faster.',
      'Set low and high bounds, update with mid + 1 or mid - 1, and stop when low <= high is empty or not found.'
    ];
    await page.getByLabel('Your thinking').fill(demoAnswers[i]);
    await page.getByRole('button', { name: 'Get feedback' }).click();
    await expect(page.getByRole('heading', { name: 'Demo feedback · keyword-based' })).toBeVisible();
    if (i === 0) {
      await page.getByRole('button', { name: 'View worked example' }).click();
      await expect(page.locator('.model-answer')).toBeVisible();
      await page.getByRole('button', { name: 'Try again (2 left)' }).click();
      await page.getByLabel('Your thinking').fill('Sorted data is required; the running time is O(log n).');
      await page.getByRole('button', { name: 'Submit revision' }).click();
      await expect(page.getByRole('button', { name: 'Try again (1 left)' })).toBeVisible();
    }
    await page.getByRole('button', { name: i === 5 ? 'Take final assessment' : 'Continue', exact: true }).click();
  }
  const final = [1, 2, 0, 3, 1, 3];
  for (let i = 0; i < final.length; i++) await page.locator(`input[name="f${i + 1}"]`).nth(final[i]).check();
  await page.getByRole('button', { name: 'See my progress', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Look what took root.' })).toBeVisible();
  await expect(page.getByText('+33 percentage points')).toBeVisible();
  await expect(page.getByText(/A short quiz indicates progress, not proof of mastery/)).toBeVisible();
  await page.screenshot({ path: 'test-results/bloom-results.png', fullPage: true });
  await page.reload(); await page.getByRole('button', { name: 'Resume session' }).click();
  await expect(page.getByRole('heading', { name: 'Look what took root.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear saved data', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear saved data', exact: true }).click();
  await expect(page.getByRole('heading', { name: /your next aha/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bloom-session-v1'))).toBeNull();
  expect(errors).toEqual([]);
});

test('mobile layout and invalid file state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByLabel('Upload course materials').setInputFiles({ name: 'program.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid file') });
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Choose nonempty PDF, TXT, or Markdown files');
  await page.screenshot({ path: 'test-results/bloom-mobile.png', fullPage: true });
});

test('API never exposes unsubmitted answers and rejects invalid transitions and tampering', async ({ request }) => {
  const start = await request.post('/api/session', { data: { action: 'demo' } }); expect(start.ok()).toBeTruthy();
  let data = await start.json(); expect(data.session.analysis.diagnostic).toBeUndefined(); expect(data.session.analysis.final).toBeUndefined();
  const early = await request.post('/api/session', { data: { action: 'final', token: data.token, answers: [1, 2, 0, 3, 1, 3] } }); expect(early.status()).toBe(400);
  data = await (await request.post('/api/session', { data: { action: 'begin', token: data.token } })).json();
  expect(data.session.questions).toHaveLength(6); expect(data.session.questions[0].answer).toBeUndefined(); expect(data.session.questions[0].explanation).toBeUndefined();
  const bad = await request.post('/api/session', { data: { action: 'resume', token: `${data.token.slice(0, 10)}AA${data.token.slice(12)}` } }); expect(bad.status()).toBe(410);
});

test('failed generation retains inputs and one-click retry resubmits the materials', async ({ page, request }) => {
  const demo = await (await request.post('/api/session', { data: { action: 'demo' } })).json();
  const payloads: string[] = [];
  await page.route('**/api/session', async route => {
    payloads.push(route.request().postData() || '');
    await route.fulfill({ status: payloads.length === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(payloads.length === 1 ? { error: 'Gemini is temporarily busy. Wait a minute, then select Try again.' } : demo) });
  });
  await page.goto('/');
  await page.getByLabel('Subject or topic').fill('Binary search');
  const notes = 'Binary search requires sorted data and halves the search interval. '.repeat(12);
  await page.getByLabel('Paste course notes').fill(notes);
  await page.getByLabel('Upload course materials').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from(notes) });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create my study session' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('temporarily busy');
  await expect(page.getByLabel('Subject or topic')).toHaveValue('Binary search');
  await expect(page.getByLabel('Paste course notes')).toHaveValue(notes);
  await expect(page.getByText('notes.txt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Here’s the big picture.' })).toBeVisible();
  expect(payloads).toHaveLength(2);
  for (const payload of payloads) { expect(payload).toContain('Binary search'); expect(payload).toContain('filename="notes.txt"'); expect(payload).toContain(notes); }
});
