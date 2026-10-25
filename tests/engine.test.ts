import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoAnalysis, demoSources, demoTasks } from '../lib/demo';
import { grade, prioritize, publicSession, seal, unseal, validateAnalysis, validateTasks } from '../lib/engine';
import type { Session } from '../lib/schema';
const makeSession = (): Session => ({ version: 1, id: 'test', createdAt: Date.now(), mode: 'demo', subject: 'CS', stage: 'diagnostic', sources: demoSources, analysis: demoAnalysis, tasks: [], taskIndex: 0, attempts: {}, hints: [], priorities: [] });
test('demo assessments have verified quotes and comparable fresh coverage', () => { validateAnalysis(demoAnalysis, demoSources); });
test('wrong answers change the prioritized topic and actual learning tasks', () => {
  const correct = demoAnalysis.diagnostic.map(q => q.answer);
  const binaryWrong = [...correct]; binaryWrong[1] = 0; binaryWrong[4] = 0;
  const hashWrong = [...correct]; hashWrong[2] = 1; hashWrong[5] = 1;
  const a = prioritize(grade(demoAnalysis.diagnostic, binaryWrong, demoAnalysis), demoAnalysis);
  const b = prioritize(grade(demoAnalysis.diagnostic, hashWrong, demoAnalysis), demoAnalysis);
  assert.equal(a[0], 'binary'); assert.equal(b[0], 'hash');
  assert.equal(demoTasks(a)[0].topicId, 'binary'); assert.equal(demoTasks(b)[0].topicId, 'hash');
  const s = makeSession(); s.priorities = a; validateTasks(demoTasks(a), s);
});
test('unsubmitted keys, future questions, hints, and model answers are not public', () => {
  const s = makeSession(); const view = publicSession(s);
  assert.ok(view.questions); assert.equal('answer' in view.questions[0], false); assert.equal('explanation' in view.questions[0], false);
  assert.equal('final' in view.analysis, false); assert.equal('text' in view.sources[0], false);
  s.stage = 'learning'; s.tasks = demoTasks(['binary', 'hash', 'structures', 'complexity']);
  const task = publicSession(s).task!;
  assert.equal('modelAnswer' in task, false); assert.equal('hint' in task, false); assert.equal('rubric' in task, false);
  assert.equal('tasks' in publicSession(s), false);
});
test('encrypted sessions round-trip, reject tampering, and expire', () => {
  process.env.SESSION_SECRET = 'test-secret-only-not-for-deployment';
  const s = makeSession(); const token = seal(s);
  assert.equal(unseal(token).id, s.id); assert.ok(!token.includes('answer'));
  const bytes = Buffer.from(token, 'base64url'); bytes[40] ^= 1;
  assert.throws(() => unseal(bytes.toString('base64url')));
  s.createdAt = Date.now() - 8 * 86400_000; assert.throws(() => unseal(seal(s)));
});
test('citation validator rejects fabricated references and quotes', () => {
  const a = structuredClone(demoAnalysis); a.topics[0].citations[0].quote = 'This quote does not exist in the source';
  assert.throws(() => validateAnalysis(a, demoSources));
});
test('quiz requires complete valid answers and scores accurately', () => {
  assert.throws(() => grade(demoAnalysis.diagnostic, [], demoAnalysis));
  assert.equal(grade(demoAnalysis.diagnostic, demoAnalysis.diagnostic.map(q => q.answer), demoAnalysis).score, 100);
});
test('phases cleanly align with Bloom hierarchy across all six tasks', () => {
  const { PHASES, getPhaseForTaskIndex } = require('../lib/schema');
  assert.equal(PHASES.length, 4);
  assert.equal(PHASES[0].title, 'Remember');
  assert.equal(PHASES[1].title, 'Understand');
  assert.equal(PHASES[2].title, 'Apply & Analyze');
  assert.equal(PHASES[3].title, 'Evaluate & Create');

  assert.equal(getPhaseForTaskIndex(0)?.phase, 1);
  assert.equal(getPhaseForTaskIndex(1)?.phase, 2);
  assert.equal(getPhaseForTaskIndex(2)?.phase, 3);
  assert.equal(getPhaseForTaskIndex(3)?.phase, 3);
  assert.equal(getPhaseForTaskIndex(4)?.phase, 4);
  assert.equal(getPhaseForTaskIndex(5)?.phase, 4);
});
test('mastery-based progression criteria requires score >= 70 or all criteria met', () => {
  const { isTaskMastered } = require('../lib/engine');
  assert.equal(isTaskMastered(undefined), false);
  assert.equal(isTaskMastered({ score: 45, summary: 'Need work', criteria: [{ criterion: 'C1', met: false, feedback: 'no' }], nextStep: 'revise' }), false);
  assert.equal(isTaskMastered({ score: 75, summary: 'Good', criteria: [{ criterion: 'C1', met: false, feedback: 'ok' }], nextStep: 'continue' }), true);
  assert.equal(isTaskMastered({ score: 65, summary: 'Met all', criteria: [{ criterion: 'C1', met: true, feedback: 'good' }], nextStep: 'continue' }), true);
});
