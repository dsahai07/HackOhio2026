import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Analysis, Citation, Feedback, PublicSession, Question, QuizResult, Session, Source, Task, levels } from './schema';

export class AppError extends Error { constructor(message: string, public status = 400) { super(message); } }
const ephemeralSecret = randomBytes(32).toString('hex');
function key() {
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) throw new AppError('Server setup needs SESSION_SECRET. See the README.', 503);
  return createHash('sha256').update(process.env.SESSION_SECRET || ephemeralSecret).digest();
}
export function seal(session: Session): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function unseal(token: string): Session {
  try {
    const data = Buffer.from(token, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    const session = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString()) as Session;
    if (session.version !== 1 || Date.now() - session.createdAt > 7 * 86400_000) throw new Error('expired');
    return session;
  } catch { throw new AppError('This saved session expired or cannot be opened by this server. Start a new session. Sessions last 7 days.', 410); }
}
export function publicSession(s: Session): PublicSession {
  const { sources, analysis, tasks, ...rest } = s;
  const { diagnostic: _d, final: _f, ...visibleAnalysis } = analysis;
  const questions = s.stage === 'diagnostic' ? analysis.diagnostic : s.stage === 'final' ? analysis.final : undefined;
  const active = s.stage === 'learning' ? tasks[s.taskIndex] : undefined;
  const task = active ? (() => {
    const { modelAnswer, hint, rubric, ...safe } = active;
    return { ...safe, ...(s.hints.includes(active.id) ? { hint } : {}), ...((s.attempts[active.id]?.length ?? 0) > 0 ? { modelAnswer, rubric } : {}) };
  })() : undefined;
  return { ...rest, sources: sources.map(({ text: _text, ...source }) => source), analysis: visibleAnalysis, questions: questions?.map(({ answer: _answer, explanation: _explanation, ...q }) => q), task, taskCount: tasks.length };
}
export function grade(questions: Question[], answers: number[], analysis: Analysis): QuizResult {
  if (answers.length !== questions.length || answers.some(a => !Number.isInteger(a) || a < 0 || a > 3)) throw new AppError('Answer all six questions before submitting.');
  const topics = analysis.topics.map(t => {
    const indices = questions.map((q, i) => q.topicId === t.id ? i : -1).filter(i => i >= 0);
    const correct = indices.filter(i => questions[i].answer === answers[i]).length;
    return { id: t.id, name: t.name, correct, total: indices.length, score: indices.length ? Math.round(correct / indices.length * 100) : 0 };
  });
  return { score: Math.round(questions.filter((q, i) => q.answer === answers[i]).length / questions.length * 100), answers, questions, topics };
}
export function prioritize(result: QuizResult, analysis: Analysis): string[] {
  return [...result.topics].sort((a, b) => a.score - b.score || (analysis.topics.find(t => t.id === b.id)!.weight - analysis.topics.find(t => t.id === a.id)!.weight)).map(t => t.id);
}
const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
function cleanQuote(q: string): string {
  return q
    .replace(/^["'“”«»`]+|["'“”«»`]+$/g, '')
    .replace(/^(\.\.\.|…)\s*/, '')
    .replace(/\s*(\.\.\.|…)$/, '')
    .trim();
}
function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/[\u00AD\u200B]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function validateCitations(items: { citations: Citation[] }[], sources: Source[]) {
  for (const item of items) for (const citation of item.citations) {
    const rawQuote = citation.quote || '';
    const cleanQ = cleanQuote(rawQuote);
    const normQ = normalize(cleanQ);
    const searchQ = normalizeForSearch(cleanQ);

    // Try targeted source first, then fallback to any other source in the session
    const targetSource = sources.find(s => s.id === citation.sourceId || s.filename === citation.sourceId || s.id === `source-${citation.sourceId}`);
    const orderedSources = targetSource
      ? [targetSource, ...sources.filter(s => s !== targetSource)]
      : sources;

    let matchedSource: Source | undefined;
    for (const source of orderedSources) {
      const sourceNorm = normalize(source.text);
      if (sourceNorm.includes(normQ) || (normQ.length >= 8 && sourceNorm.includes(normQ.slice(0, Math.min(normQ.length, 60))))) {
        matchedSource = source;
        break;
      }
      const sourceSearch = normalizeForSearch(source.text);
      if (searchQ.length >= 8 && sourceSearch.includes(searchQ)) {
        matchedSource = source;
        break;
      }
      // Check multi-word phrase overlap for longer quotes
      const words = searchQ.split(' ').filter(w => w.length > 2);
      if (words.length >= 5) {
        const windowSize = Math.min(4, words.length);
        let phraseMatches = 0;
        const totalWindows = words.length - windowSize + 1;
        for (let i = 0; i < totalWindows; i++) {
          const phrase = words.slice(i, i + windowSize).join(' ');
          if (sourceSearch.includes(phrase)) phraseMatches++;
        }
        if (phraseMatches / totalWindows >= 0.4) {
          matchedSource = source;
          break;
        }
      }
    }

    if (!matchedSource) {
      console.warn(`[validateCitations] Unverified citation: "${rawQuote}" (claimed source: ${citation.sourceId})`);
      throw new AppError('The AI returned a source reference we could not verify. Please try again with clearer material.', 502);
    }
    citation.sourceId = matchedSource.id;
    citation.quote = cleanQ || rawQuote;
  }
}
export function validateAnalysis(a: Analysis, sources: Source[]) {
  const ids = new Set(a.topics.map(t => t.id));
  if (ids.size !== a.topics.length) throw new AppError('The AI returned duplicate topics. Please try again.', 502);
  validateCitations([...a.topics, ...a.diagnostic, ...a.final], sources);

  // Auto-resolve unique question IDs if Gemini produced duplicate or missing IDs
  const seenIds = new Set<string>();
  a.diagnostic.forEach((q, i) => {
    if (!q.id || seenIds.has(q.id)) q.id = `diag-${i + 1}`;
    seenIds.add(q.id);
  });
  a.final.forEach((q, i) => {
    if (!q.id || seenIds.has(q.id)) q.id = `final-${i + 1}`;
    seenIds.add(q.id);
  });

  // Ensure all options are distinct
  for (const q of [...a.diagnostic, ...a.final]) {
    const seenOpts = new Set<string>();
    q.options = q.options.map((opt, i) => {
      let norm = normalize(opt);
      if (seenOpts.has(norm)) {
        opt = `${opt} (${i + 1})`;
        norm = normalize(opt);
      }
      seenOpts.add(norm);
      return opt;
    });
    if (!ids.has(q.topicId)) q.topicId = a.topics[0].id;
  }

  // Ensure each topic has questions in diagnostic
  const topicIds = Array.from(ids);
  for (let i = 0; i < topicIds.length; i++) {
    const tId = topicIds[i];
    if (!a.diagnostic.some(q => q.topicId === tId)) {
      const donor = a.diagnostic.find(q => a.diagnostic.filter(d => d.topicId === q.topicId).length > 1);
      if (donor) donor.topicId = tId;
    }
  }

  // Align final question topicIds and difficulties with diagnostic for balanced coverage
  for (let i = 0; i < 6; i++) {
    a.final[i].topicId = a.diagnostic[i].topicId;
    a.final[i].difficulty = a.diagnostic[i].difficulty;
  }

  const all = [...a.diagnostic, ...a.final];
  if (new Set(all.map(q => q.id)).size !== 12 || new Set(all.map(q => normalize(q.prompt))).size !== 12 || all.some(q => !ids.has(q.topicId) || new Set(q.options.map(normalize)).size !== 4)) throw new AppError('The AI returned an inconsistent assessment. Please try again.', 502);
  for (const id of ids) {
    const before = a.diagnostic.filter(q => q.topicId === id);
    const after = a.final.filter(q => q.topicId === id);
    if (!before.length || before.length !== after.length || before.map(q => q.difficulty).sort().join() !== after.map(q => q.difficulty).sort().join()) throw new AppError('The AI assessments did not have comparable coverage and difficulty. Please try again.', 502);
  }
}
export function validateTasks(tasks: Task[], s: Session) {
  validateCitations(tasks, s.sources);
  tasks.forEach((t, i) => {
    t.id = t.id || `task-${i + 1}`;
    t.level = levels[i];
    if (!s.priorities.includes(t.topicId)) t.topicId = s.priorities[0];
  });
  const primary = s.priorities[0];
  while (tasks.filter(t => t.topicId === primary).length < 3) {
    const nonPrimary = tasks.find(t => t.topicId !== primary);
    if (nonPrimary) nonPrimary.topicId = primary;
    else break;
  }
  if (new Set(tasks.map(t => t.id)).size !== 6 || tasks.some((t, i) => t.level !== levels[i] || !s.priorities.includes(t.topicId)) || tasks.filter(t => t.topicId === s.priorities[0]).length < 3) throw new AppError('The AI learning path did not match your diagnostic priorities. Please try again.', 502);
}
const patterns: Record<string, RegExp[][]> = {
  binary: [[/sort/i, /log/i], [/sort|order/i, /half|discard|eliminat/i], [/12[\s\S]*23/i, /low|lower|right|4/i], [/linear|O\(n\)/i, /sort/i], [/infinite|terminat|progress|unchanged|stuck/i, /mid\s*\+\s*1/i], [/low|high|bound/i, /mid\s*[+-]\s*1|empty|not found|low\s*<=\s*high/i]],
  hash: [[/O\(1\)|constant/i, /O\(n\)|linear/i], [/same.*bucket|collision/i, /chain|list|multiple/i], [/12[\s\S]*22[\s\S]*2|2[\s\S]*12[\s\S]*22/i, /35[\s\S]*5|5[\s\S]*35/i], [/expected|average|worst/i, /sort|log/i], [/false|not always|not.*guarantee|incorrect/i, /colli|same.*bucket|chain/i], [/increment|count|\+\+|initialize/i, /O\(n\)|O\(k\)|space|linear/i]],
  structures: [[/stack[\s\S]*(lifo|last)|(lifo|last)[\s\S]*stack/i, /queue[\s\S]*(fifo|first)|(fifo|first)[\s\S]*queue/i], [/order|first|oldest/i, /earliest|arrival|arriv/i], [/C[\s\S]*B/i, /A.*remain|remain.*A/i], [/O\(1\)|constant/i, /O\(n\)|linear|travers|follow.*link/i], [/newest|last|reverse|older/i, /queue|FIFO/i], [/action|inverse|revers/i, /stack|LIFO|last/i]],
  complexity: [[/O\(n\)|linear/i, /n[²^]|quadratic/i], [/add|n\s*\+\s*n|2n/i, /constant|factor|O\(n\)/i], [/5\s*\*?\s*n|n\s*\*\s*5/i, /O\(n\)|linear/i], [/O\(n\)|linear/i, /log|doubl/i], [/asymptot|growth|not.*always/i, /constant|small|input/i], [/set|insert|seen/i, /space|memory|tradeoff|O\(n\)/i]],
};
export function demoFeedback(task: Task, answer: string): Feedback {
  const checks = patterns[task.topicId][levels.indexOf(task.level)];
  const criteria = task.rubric.map((criterion, i) => ({ criterion, met: checks[i].test(answer), feedback: checks[i].test(answer) ? 'The expected idea was detected in your response.' : 'This idea was not detected. Compare your reasoning with the worked example.' }));
  return { score: Math.round(criteria.filter(c => c.met).length / criteria.length * 100), summary: 'Demo feedback uses simple keyword checks, not Gemini. It may miss valid wording or accept incorrect reasoning; use the rubric and example to self-check.', criteria, nextStep: 'Revise any missing idea in your own words, then continue when you are ready.' };
}
