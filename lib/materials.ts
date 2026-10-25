import 'server-only';
import { extractText, getDocumentProxy } from 'unpdf';
import { AppError } from './engine';
import { Source } from './schema';
export const MAX_FILE = 5 * 1024 * 1024;
export async function readMaterials(form: FormData): Promise<Source[]> {
  const sources: Source[] = [];
  let chars = 0;
  function add(filename: string, text: string, exam: boolean, page?: number) {
    const cleaned = text.replace(/\u0000/g, '').trim();
    if (!cleaned) return;
    chars += cleaned.length;
    if (chars > 50_000) throw new AppError('Materials exceed 50,000 extracted characters. Upload a shorter selection of notes.');
    sources.push({ id: `source-${sources.length + 1}`, filename: filename.slice(0, 160), text: cleaned, exam, ...(page ? { page } : {}) });
  }
  const pasted = String(form.get('text') || '');
  if (pasted.length > 50_000) throw new AppError('Pasted notes must be at most 50,000 characters.');
  add('Pasted notes', pasted, false);
  const files = [...form.getAll('materials').map(file => ({ file, exam: false })), ...form.getAll('exam').map(file => ({ file, exam: true }))];
  if (files.length > 6 || form.getAll('exam').length > 1) throw new AppError('Use up to 5 resources and 1 practice exam.');
  if (form.getAll('materials').length > 5) throw new AppError('Use up to 5 resource files.');
  for (const { file, exam } of files) {
    if (!(file instanceof File) || !file.size || file.size > MAX_FILE) throw new AppError('Each file must be nonempty and at most 5 MB.');
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'txt', 'md', 'markdown'].includes(extension || '')) throw new AppError('Only PDF, TXT, and Markdown files are supported.');
    const buffer = new Uint8Array(await file.arrayBuffer());
    if (extension === 'pdf') {
      if (new TextDecoder().decode(buffer.slice(0, 5)) !== '%PDF-') throw new AppError(`${file.name} is not a valid PDF.`);
      let pdf;
      try {
        pdf = await getDocumentProxy(buffer);
        if (pdf.numPages > 40) throw new AppError('Each PDF must have 40 pages or fewer.');
        const { text } = await extractText(pdf, { mergePages: false });
        if (!text.join('').trim()) throw new AppError(`${file.name} has no extractable text. Scanned PDFs need OCR first; paste the text instead.`);
        text.forEach((pageText, index) => add(file.name, pageText, exam, index + 1));
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Could not read ${file.name}. Try an unlocked text-based PDF, TXT, or Markdown file.`);
      } finally { await pdf?.loadingTask.destroy(); }
    } else {
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { throw new AppError(`${file.name} must use UTF-8 text encoding.`); }
      if (text.includes('\u0000')) throw new AppError(`${file.name} appears to be a binary file, not text.`);
      add(file.name, text, exam);
    }
  }
  const studyText = sources.filter(s => !s.exam).map(s => s.text).join(' ');
  if (studyText.length < 400 || studyText.split(/\s+/).length < 60) throw new AppError('Add at least 400 characters and 60 words of substantive course notes, in addition to any practice exam. A topic name alone is not enough to ground a session.');
  return sources;
}
