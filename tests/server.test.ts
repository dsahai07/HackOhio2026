import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { readMaterials } from '../lib/materials';
import { generate } from '../lib/gemini';
import { demoSources } from '../lib/demo';

const notes = demoSources.map(s => s.text).join('\n');
function formWithNotes() { const f = new FormData(); f.set('text', notes); return f; }
function makePdf(lines: string[]): Uint8Array {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${lines.map((_, i) => `${4 + 2 * i} 0 R`).join(' ')}] /Count ${lines.length} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  lines.forEach((line, i) => {
    const stream = `BT /F1 10 Tf 50 700 Td (${line.replace(/[()\\]/g, '\\$&')}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + 2 * i} 0 R >>`, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  let pdf = '%PDF-1.4\n'; const offsets: number[] = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf));
}
test('materials accept UTF-8 notes and mark an optional exam separately', async () => {
  const f = new FormData(); f.append('materials', new File([notes], 'notes.md')); f.append('exam', new File(['Review: explain binary search.'], 'review.txt'));
  const sources = await readMaterials(f);
  assert.equal(sources[0].filename, 'notes.md'); assert.equal(sources[0].exam, false); assert.equal(sources[1].exam, true);
});
test('PDF extraction retains actual page numbers', async () => {
  const f = formWithNotes(); const bytes = makePdf(['Binary search requires sorted data.', 'Hash tables use buckets for keys.']);
  f.append('materials', new File([bytes as Uint8Array<ArrayBuffer>], 'lecture.pdf', { type: 'application/pdf' }));
  const pages = (await readMaterials(f)).filter(s => s.filename === 'lecture.pdf');
  assert.equal(pages.length, 2); assert.equal(pages[0].page, 1); assert.equal(pages[1].page, 2); assert.match(pages[1].text, /Hash tables/);
});
test('materials reject unsupported, oversized, fake PDFs, insufficient, and excessive text', async () => {
  for (const file of [new File(['bad'], 'bad.exe'), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.txt'), new File(['not a pdf'], 'fake.pdf')]) {
    const f = formWithNotes(); f.append('materials', file); await assert.rejects(readMaterials(f));
  }
  const short = new FormData(); short.set('text', 'Binary search'); await assert.rejects(readMaterials(short), /400 characters/);
  const huge = new FormData(); huge.set('text', 'word '.repeat(10001)); await assert.rejects(readMaterials(huge), /50,000/);
});
test('Gemini request uses server key and JSON schema; handles output and provider failures', async () => {
  const originalFetch = globalThis.fetch; const oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-placeholder-not-a-real-key';
  const schema = z.object({ explanation: z.string().min(5) });
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal((init!.headers as Record<string, string>)['x-goog-api-key'], 'test-placeholder-not-a-real-key');
      const body = JSON.parse(String(init!.body));
      assert.equal(body.generationConfig.responseMimeType, 'application/json');
      assert.ok(body.generationConfig.responseJsonSchema);
      assert.equal(body.generationConfig.responseJsonSchema.properties.explanation.minLength, undefined);
      assert.match(body.systemInstruction.parts[0].text, /NEVER instructions/);
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ explanation: 'Sorted order enables halving.' }) }] } }] });
    };
    assert.equal((await generate(schema, 'Explain.', {})).explanation, 'Sorted order enables halving.');
    globalThis.fetch = async () => new Response('', { status: 429 }); await assert.rejects(generate(schema, '', {}), /quota/);
    globalThis.fetch = async () => new Response('', { status: 403 }); await assert.rejects(generate(schema, '', {}), /server API key/);
    globalThis.fetch = async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"invalid": true}' }] } }] }); await assert.rejects(generate(schema, '', {}), /invalid content/);
    globalThis.fetch = async () => { throw new DOMException('timeout', 'TimeoutError'); }; await assert.rejects(generate(schema, '', {}), /too long/);
    delete process.env.GEMINI_API_KEY; await assert.rejects(generate(schema, '', {}), /not configured/);
  } finally { globalThis.fetch = originalFetch; if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey; }
});
