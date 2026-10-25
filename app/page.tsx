'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronRight, CircleHelp, FileText, Flame, Flower2, Layers, Leaf, Lightbulb, LoaderCircle, Lock, Plus, RotateCcw, ShieldCheck, Sparkles, Sprout, Target, Trash2, Upload, X } from 'lucide-react';
import type { Citation, Envelope, PublicSession, QuizResult, PublicTask, Attempt, Feedback, Topic } from '@/lib/schema';
import { levels, PHASES, getPhaseForTaskIndex } from '@/lib/schema';
import { isTaskMastered } from '@/lib/engine';

const STORAGE = 'bloom-session-v1';
type Saved = { envelope: Envelope; answers: Record<string, number>; draft: string };
const levelDetails = ['Bring the essentials to mind.', 'Make the idea your own.', 'Put knowledge to work.', 'Find the connections.', 'Make a reasoned judgment.', 'Build something original.'];

export default function Home() {
  const [activeTab, setActiveTab] = useState<'study' | 'home' | 'taxonomy'>('study');
  const [selectedFormat, setSelectedFormat] = useState<string>('frq');
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [exam, setExam] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [retry, setRetry] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const busyRef = useRef(false);
  const failedRequest = useRef<{ action: string; extra: Record<string, unknown>; form?: FormData } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const s = envelope?.session;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const value = JSON.parse(raw);
        if (typeof value?.envelope?.token !== 'string' || !value.envelope.session || typeof value.answers !== 'object' || typeof value.draft !== 'string') throw new Error();
        setSaved(value);
      }
    } catch { setStorageError('Saved data could not be read. You can still start a new session or clear saved data.'); }
  }, []);
  useEffect(() => {
    if (!envelope) return;
    const value = { envelope, answers, draft };
    try { localStorage.setItem(STORAGE, JSON.stringify(value)); setSaved(value); setStorageError(''); }
    catch { setStorageError('Your browser could not save this session. Keep this tab open to retain progress.'); }
  }, [envelope, answers, draft]);
  useEffect(() => { if (s) headingRef.current?.focus(); }, [s?.stage, s?.taskIndex]); // Move focus only when the step changes.
  useEffect(() => {
    if (s?.task?.format) setSelectedFormat(s.task.format);
    else setSelectedFormat('frq');
    setSelectedLeft(null);
    setMatches({});
  }, [s?.task?.id, s?.task?.format]);

  async function request(action: string, extra: Record<string, unknown> = {}, form?: FormData) {
    if (busyRef.current) return;
    busyRef.current = true;
    failedRequest.current = null;
    setError('');
    setBusy(action === 'start' ? 'Reading your sources and preparing your assessments…' : action === 'diagnostic' ? 'Finding your focus and building your learning path…' : action === 'answer' ? 'Reading your reasoning against the rubric…' : 'Preparing your next step…');
    try {
      const res = await fetch('/api/session', { method: 'POST', headers: form ? undefined : { 'Content-Type': 'application/json' }, body: form || JSON.stringify({ action, token: envelope?.token, ...extra }), signal: AbortSignal.timeout(85_000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to complete this step. Please try again.');
      setEnvelope(data);
      if (action === 'resume' && saved) { setAnswers(saved.answers); setDraft(saved.draft); }
      else if (!['hint', 'answer'].includes(action)) { setAnswers({}); setDraft(''); setShowExample(false); }
      if (action === 'answer' || action === 'next') setRetry(false);
      if (!['hint', 'answer'].includes(action)) window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      failedRequest.current = { action, extra, form };
      setError(err instanceof Error && ['TimeoutError', 'AbortError'].includes(err.name) ? 'The request timed out. Your previous progress is saved. Please try again.' : err instanceof Error ? err.message : 'Connection interrupted. Please try again.');
    } finally { setBusy(''); busyRef.current = false; }
  }
  function chooseFiles(list: FileList | null, isExam = false) {
    failedRequest.current = null;
    if (!list) return;
    const incoming = Array.from(list);
    if (incoming.some(f => !/\.(pdf|txt|md|markdown)$/i.test(f.name) || f.size === 0 || f.size > 5 * 1024 * 1024)) { setError('Choose nonempty PDF, TXT, or Markdown files, up to 5 MB each.'); return; }
    if (isExam) setExam(incoming[0] || null);
    else if (files.length + incoming.length > 5) { setError('You can add up to five resource files.'); return; }
    else setFiles(previous => [...previous, ...incoming]);
    setError('');
  }
  function start() {
    failedRequest.current = null;
    if (subject.trim().length < 2) { setError('Add a subject or topic for your session.'); return; }
    if (!files.length && text.trim().length < 400) { setError('Add course resources or paste at least 400 characters of notes.'); return; }
    if (!consent) { setError('Acknowledge that your materials will be sent to Gemini to continue.'); return; }
    const form = new FormData();
    form.set('subject', subject); form.set('text', text); form.set('consent', 'yes');
    files.forEach(f => form.append('materials', f)); if (exam) form.append('exam', exam);
    void request('start', {}, form);
  }
  function clear() {
    try { localStorage.removeItem(STORAGE); setStorageError(''); } catch { setStorageError('Browser storage could not be cleared. Clear this site’s data in your browser settings.'); }
    failedRequest.current = null;
    setEnvelope(null); setSaved(null); setAnswers({}); setDraft(''); setFiles([]); setExam(null); setText(''); setSubject(''); setConsent(false); setError(''); setConfirmClear(false);
  }
  const currentStep = !s ? 0 : s.stage === 'analysis' ? 1 : ['diagnostic', 'diagnostic-results'].includes(s.stage) ? 2 : s.stage === 'learning' ? 3 : 4;
  const attempts = s?.task ? s.attempts[s.task.id] || [] : [];
  const latest = attempts.at(-1);
  const isMastered = isTaskMastered(latest?.feedback);
  const answered = s?.questions?.filter(q => answers[q.id] !== undefined).length || 0;

  // Gamification & Numerical Indicators Calculations
  const overallProgress = !s ? 0
    : s.stage === 'analysis' ? 10
    : ['diagnostic', 'diagnostic-results'].includes(s.stage) ? (s.stage === 'diagnostic' ? 10 + Math.round((answered / 6) * 15) : 25)
    : s.stage === 'learning' ? Math.min(80, 25 + Math.round(((s.taskIndex + (latest && isMastered ? 1 : 0)) / s.taskCount) * 55))
    : s.stage === 'final' ? 80 + Math.round((answered / 6) * 15)
    : 100;
  const xp = !s ? 0
    : (s.diagnostic ? 100 : 0) + (['learning', 'final', 'complete'].includes(s.stage) ? s.taskIndex * 75 + (isMastered ? 50 : 0) : 0) + (s.final ? 150 : 0);
  const streak = s?.stage === 'learning' ? Math.max(1, s.taskIndex + (isMastered ? 1 : 0)) : s?.stage === 'complete' ? 6 : 0;
  const currentPhase = getPhaseForTaskIndex(s?.taskIndex || 0);

  // Sequential Topic Mapping
  const orderedTopics = [...(s?.analysis?.topics || [])].sort((a, b) => (a.lectureOrder || 0) - (b.lectureOrder || 0));
  const activeTopicId = s?.task?.topicId || s?.priorities?.[0] || orderedTopics[0]?.id;
  const activeTopicIndex = orderedTopics.findIndex(t => t.id === activeTopicId);

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="topbar">
      <a href="/" className="brand" aria-label="Bloom home" onClick={e => { e.preventDefault(); setActiveTab('study'); }}>
        <span className="brand-icon"><Flower2 size={29} strokeWidth={1.5}/></span>bloom<span className="brand-dot">.</span>
      </a>
      <nav className="nav-links" aria-label="Main Navigation">
        <button
          type="button"
          className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          Home
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'taxonomy' ? 'active' : ''}`}
          onClick={() => setActiveTab('taxonomy')}
        >
          Bloom’s Taxonomy
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'study' ? 'active' : ''}`}
          onClick={() => setActiveTab('study')}
        >
          Study Session {s && <span className="nav-badge">Active</span>}
        </button>
      </nav>
      <span className="header-note desktop-only">A little understanding, every day.</span>
      <div className="header-actions">
        <span className="local-badge"><span/> Your personal study space</span>
        <button className="icon-button" aria-label="Clear saved data" title="Clear saved data" disabled={!!busy} onClick={() => setConfirmClear(true)}>
          <Trash2 size={17}/>
        </button>
      </div>
    </header>

    <div className="workspace">
      <aside className="sidebar" aria-label="Session progress">
        <div>
          <p className="eyebrow">YOUR STUDY SESSION</p>
          <ol className="steps">
            {['Add materials', 'Find the big ideas', 'Check your starting point', 'Grow your understanding', 'See your progress'].map((name, i) => (
              <li key={name} className={`${currentStep === i ? 'active' : ''} ${currentStep > i ? 'done' : ''}`} aria-current={currentStep === i ? 'step' : undefined}>
                <span className="step-number">{currentStep > i ? <Check size={14}/> : String(i + 1).padStart(2, '0')}</span>
                <span>{name}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="sidebar-bottom">
          <div className="growth-illustration" aria-hidden="true">
            <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
            <Sprout size={72} strokeWidth={1}/><span className="small-star">✧</span>
          </div>
          <h3>Good learning takes root.</h3>
          <p>Start with what you know.<br/>Grow one idea at a time.</p>
          <div className="sidebar-foot"><ShieldCheck size={14}/> No account. Just curiosity.</div>
        </div>
      </aside>

      <main id="main" className="main-content" aria-busy={!!busy}>
        {activeTab === 'home' && <HomePageView onStartSession={() => setActiveTab('study')} />}
        {activeTab === 'taxonomy' && <TaxonomyPageView onStartSession={() => setActiveTab('study')} />}

        {activeTab === 'study' && <>
          <div className="breadcrumb">My study space <ChevronRight size={13}/><span>{s?.subject || 'New session'}</span></div>
          {s?.mode === 'demo' && <div className="demo-banner"><Sparkles size={16}/><strong>CS demo</strong><span>Built-in content · No Gemini calls · Your uploads are not used</span></div>}
          {storageError && <div className="notice warning" role="status">{storageError}</div>}
          {error && <div className="notice error" role="alert"><CircleHelp size={19}/><span>{error}</span>{failedRequest.current && <button className="button secondary" disabled={!!busy} onClick={() => { const failed = failedRequest.current; if (failed) void request(failed.action, failed.extra, failed.form); }}>Try again</button>}<button aria-label="Dismiss error" className="icon-button" onClick={() => setError('')}><X size={16}/></button></div>}
          {busy && <div className="busy-bar" role="status"><LoaderCircle size={18} className="spin"/>{busy}<span>Usually under a minute</span></div>}

          {/* Gamification Progress Strip */}
          <div className="overall-progress-strip" aria-label="Course module progress">
            <div className="progress-strip-left">
              <span className="progress-strip-label">Course Module Progress</span>
              <div className="overall-meter-track" role="progressbar" aria-valuenow={overallProgress} aria-valuemin={0} aria-valuemax={100}>
                <div className="overall-meter-fill" style={{ width: `${overallProgress}%` }} />
              </div>
              <span className="overall-percent-num">{overallProgress}%</span>
            </div>
            <div className="progress-strip-stats">
              <span className="gamification-stat streak-stat" title="Mastery Streak"><Flame size={14}/> {streak} Step Streak</span>
              <span className="gamification-stat xp-stat" title="Bloom XP Earned"><Sparkles size={14}/> {xp} XP</span>
              {s?.task && <span className="gamification-stat" title="Active Cognitive Phase"><Leaf size={14}/> Phase 0{currentPhase.phase}: {currentPhase.title}</span>}
            </div>
          </div>

          {/* Structured Assessment Lifecycle Stepper */}
          {s && (
            <div className="assessment-lifecycle-tracker" aria-label="Assessment Lifecycle">
              <div className={`lifecycle-step-card ${['diagnostic', 'diagnostic-results'].includes(s.stage) ? 'active' : ['learning', 'final', 'complete'].includes(s.stage) ? 'completed' : ''}`}>
                <span className="lifecycle-step-num">Step 01 · Entry</span>
                <strong className="lifecycle-step-name">Diagnostic Check</strong>
                <span className="lifecycle-step-type">MCQ Baseline Check</span>
              </div>
              <div className={`lifecycle-step-card ${s.stage === 'learning' ? 'active' : ['final', 'complete'].includes(s.stage) ? 'completed' : ''}`}>
                <span className="lifecycle-step-num">Step 02 · Core</span>
                <strong className="lifecycle-step-name">Mastery Learning</strong>
                <span className="lifecycle-step-type">Blended Question Formats</span>
              </div>
              <div className={`lifecycle-step-card ${s.stage === 'final' ? 'active' : s.stage === 'complete' ? 'completed' : ''}`}>
                <span className="lifecycle-step-num">Step 03 · Exit</span>
                <strong className="lifecycle-step-name">Comprehensive Test</strong>
                <span className="lifecycle-step-type">MCQ Knowledge Verification</span>
              </div>
              <div className={`lifecycle-step-card ${s.stage === 'complete' ? 'active completed' : ''}`}>
                <span className="lifecycle-step-num">Step 04 · Outcomes</span>
                <strong className="lifecycle-step-name">Growth Report</strong>
                <span className="lifecycle-step-type">Before → After Gain Metrics</span>
              </div>
            </div>
          )}

          {!s && <>
            <div className="page-heading"><span className="kicker"><Leaf size={14}/> FROM INFORMATION TO UNDERSTANDING</span><h1>Make room for<br/><em>your next aha.</em></h1><p>Your notes are the beginning. Let’s turn them into a study<br className="desktop-break"/> session that meets you where you are.</p></div>
            {saved && <div className="resume-card"><div><strong>Your study session is waiting.</strong><p>{saved.envelope.session.subject} · Saved on this browser</p></div><button className="button secondary" disabled={!!busy} onClick={() => request('resume', { token: saved.envelope.token })}>Resume session <ArrowRight size={16}/></button></div>}
            <BloomTaxonomyIntro />
            <div className="start-grid">
              <section className="card materials-card" aria-labelledby="materials-title"><div className="card-title"><span className="soft-icon"><BookOpen size={20}/></span><div><h2 id="materials-title">What are we learning?</h2><p>Bring your materials. We’ll connect the dots.</p></div><span className="step-tag">STEP 01</span></div>
                <label className="field-label" htmlFor="subject">Subject or topic <span>Required</span></label><input id="subject" placeholder="e.g. Data structures & algorithms" value={subject} maxLength={120} onChange={e => setSubject(e.target.value)} disabled={!!busy}/>
                <div className="label-row"><label className="field-label" htmlFor="materials">Course materials</label><span>Up to 5 files</span></div>
                <label className={`upload-zone ${busy ? 'disabled' : ''}`} htmlFor="materials"><span className="upload-icon"><Upload size={22}/></span><strong>Give your notes a place to grow</strong><span>Choose files <ArrowUpRight size={12}/> <span className="muted">from your computer</span></span><small>PDF, TXT, or Markdown · 5 MB per file · 40 pages per PDF</small><input id="materials" aria-label="Upload course materials" type="file" accept=".pdf,.txt,.md,.markdown" multiple disabled={!!busy} onChange={e => { chooseFiles(e.target.files); e.target.value = ''; }}/></label>
                {files.length > 0 && <ul className="file-list">{files.map((file, i) => <li key={`${file.name}-${i}`}><FileText size={15}/><span>{file.name}</span><small>{Math.ceil(file.size / 1024)} KB</small><button aria-label={`Remove ${file.name}`} className="icon-button" disabled={!!busy} onClick={() => setFiles(files.filter((_, index) => index !== i))}><X size={14}/></button></li>)}</ul>}
                <div className="or-divider"><span>or paste your notes</span></div><textarea id="notes" aria-label="Paste course notes" placeholder="Definitions, lecture notes, that concept you want to finally understand…" rows={4} value={text} maxLength={50000} disabled={!!busy} onChange={e => setText(e.target.value)}/><div className="input-help">At least 400 characters and 60 words of notes. 50,000 characters total.</div>
                <div className="exam-upload"><div className="exam-title"><FileText size={19}/><div><strong>Have a practice exam?</strong><p>Match your session to its topics and difficulty.</p></div><span className="optional">OPTIONAL</span></div><label className="exam-button" htmlFor="exam"><Plus size={15}/>{exam ? exam.name : 'Add a practice exam or review sheet'}<input id="exam" aria-label="Upload practice exam" type="file" accept=".pdf,.txt,.md,.markdown" disabled={!!busy} onChange={e => { chooseFiles(e.target.files, true); e.target.value = ''; }}/></label>{exam && <button className="text-button" disabled={!!busy} onClick={() => setExam(null)}>Remove exam</button>}</div>
                <label className="consent"><input type="checkbox" checked={consent} disabled={!!busy} onChange={e => setConsent(e.target.checked)}/><span>I understand that generating a session sends my materials and study responses to Google Gemini for analysis and feedback.</span></label>
                <button className="button primary wide" onClick={start} disabled={!!busy}>Create my study session <ArrowRight size={17}/></button><p className="private-note"><ShieldCheck size={13}/> Progress saved in this browser. No account needed.</p>
              </section>
              <aside className="right-column"><section className="path-card"><span className="eyebrow">MORE THAN MEMORIZATION</span><h2>Six ways to <br/>make it stick.</h2><p>A thoughtful path through <br/>Bloom’s taxonomy.</p><ol className="taxonomy-list">{levels.map((level, i) => <li key={level}><span className={`level-seed seed-${i}`}>{String(i + 1).padStart(2, '0')}</span><div><strong>{level}</strong><small>{levelDetails[i]}</small></div></li>)}</ol><div className="path-footer"><Sparkles size={15}/> Adapts to what you need most</div></section>
                <section className="demo-card"><span className="demo-pill">NO MATERIALS? NO PROBLEM.</span><h3>Take Bloom for a spin.</h3><p>Explore a complete computer science session with our built-in demo.</p><div className="demo-topics"><span>Data structures</span><span>Binary search</span><span>Hash tables</span><span>Complexity</span></div><button className="text-button" disabled={!!busy} onClick={() => request('demo')}>Try the CS demo <ArrowUpRight size={17}/></button><small>No API key needed. Uses sample content.</small></section>
              </aside>
            </div><div className="bottom-note"><span>Rooted in learning science.</span> Designed for your next breakthrough.</div>
          </>}

          {s?.stage === 'analysis' && <>
            <div className="page-heading compact"><span className="kicker"><Sparkles size={14}/> YOUR MATERIALS, CONNECTED</span><h1 ref={headingRef} tabIndex={-1}>Here’s the <em>big picture.</em></h1><p>{s.analysis.summary}</p></div>
            <SequentialLectureMap session={s} currentTopicId={activeTopicId} />
            <section className="card section-card">
              <div className="insight"><Target size={21}/><div><h3>Your assessment blueprint</h3><p>{s.analysis.examInsight}</p></div></div>
              <button className="button primary" disabled={!!busy} onClick={() => request('begin')}>Take the 6-question diagnostic <ArrowRight size={17}/></button>
              <p className="input-help">A starting point, not a grade. Your answers shape what comes next.</p>
            </section>
          </>}

          {s && ['diagnostic', 'final'].includes(s.stage) && <>
            <div className="page-heading compact"><span className="kicker"><Target size={14}/>{s.stage === 'final' ? 'A FRESH PERSPECTIVE' : 'LET’S FIND YOUR STARTING POINT'}</span><h1 ref={headingRef} tabIndex={-1}>{s.stage === 'final' ? <>See how you’ve <em>grown.</em></> : <>What’s already <em>taking root?</em></>}</h1><p>{s.stage === 'final' ? 'Six fresh questions. Comparable coverage and difficulty. Take your time.' : 'Six questions to help us focus your session. It’s okay not to know yet.'}</p></div>
            <div className="quiz-progress"><span>{answered} of 6 answered</span><progress max={6} value={answered} aria-label="Questions answered"/></div>
            <div className="quiz-list">{s.questions?.map((q, i) => <fieldset key={q.id} className="card question-card"><legend><span className="question-number">{String(i + 1).padStart(2, '0')}</span>{q.prompt}</legend><div className="question-meta">{s.analysis.topics.find(t => t.id === q.topicId)?.name}<span>·</span>{q.difficulty}</div><div className="options">{q.options.map((option, index) => <label key={index} className={`option ${answers[q.id] === index ? 'selected' : ''}`}><input type="radio" name={q.id} value={index} checked={answers[q.id] === index} disabled={!!busy} onChange={() => setAnswers({ ...answers, [q.id]: index })}/><span className="option-letter">{'ABCD'[index]}</span><span>{option}</span>{answers[q.id] === index && <CheckCircle2 size={18}/>}</label>)}</div></fieldset>)}</div>
            <div className="action-row"><span>Answer all six to continue.</span><button className="button primary" disabled={answered !== 6 || !!busy} onClick={() => request(s.stage === 'final' ? 'final' : 'diagnostic', { answers: s.questions?.map(q => answers[q.id]) })}>{s.stage === 'final' ? 'See my progress' : 'Build my learning path'}<ArrowRight size={17}/></button></div>
          </>}

          {s?.stage === 'diagnostic-results' && s.diagnostic && <>
            <div className="page-heading compact"><span className="kicker"><Sprout size={14}/> A PATH THAT STARTS WITH YOU</span><h1 ref={headingRef} tabIndex={-1}>Now we know <em>where to grow.</em></h1><p>Your starting score is {s.diagnostic.score}%. We’ll give extra attention to {s.analysis.topics.find(t => t.id === s.priorities[0])?.name.toLowerCase()}.</p></div>
            <Performance result={s.diagnostic}/><div className="card section-card"><h2>Your personalized focus</h2><p className="body-copy">{s.diagnostic.score === 100 ? 'You answered every question correctly. We’ll deepen your reasoning, starting with the most heavily weighted topic.' : 'Lower-scoring topics come first. Ties are broken by topic importance in your study blueprint.'} The first-priority topic appears in at least three of your six Bloom tasks.</p><div className="priority-list">{s.priorities.map((id, i) => <span className="pill" key={id}>{i + 1}. {s.analysis.topics.find(t => t.id === id)?.name}</span>)}</div><button className="button primary" disabled={!!busy} onClick={() => request('learn')}>Start personalized learning <ArrowRight size={17}/></button></div><Review result={s.diagnostic} session={s}/>
          </>}

          {s?.stage === 'learning' && s.task && <>
            <div className="learning-top"><span className="kicker"><Leaf size={14}/> GROW YOUR UNDERSTANDING</span><span className="pill">Task {s.taskIndex + 1} of {s.taskCount}</span></div>
            <CognitivePhaseTracker taskIndex={s.taskIndex} latestFeedback={latest?.feedback} />
            <SequentialLectureMap session={s} currentTopicId={activeTopicId} />
            <div className="level-progress" aria-label="Bloom learning progress">{levels.map((level, i) => <div key={level} className={`${i === s.taskIndex ? 'current' : ''} ${i < s.taskIndex ? 'complete' : ''}`} aria-current={i === s.taskIndex ? 'step' : undefined}><span>{i < s.taskIndex ? <Check size={12}/> : i + 1}</span>{level}</div>)}</div>
            <div className="page-heading compact"><h1 ref={headingRef} tabIndex={-1}>{s.task.level}<em> & grow.</em></h1><p>{s.analysis.topics.find(t => t.id === s.task?.topicId)?.name} · {levelDetails[s.taskIndex]}</p></div>
            <section className="teaching-card"><span className="soft-icon"><BookOpen size={21}/></span><div><h2>A little context</h2><p>{s.task.teaching}</p><Citations citations={s.task.citations} session={s}/></div></section>
            <section className="card section-card task-card">
              <span className="eyebrow">YOUR TURN</span>
              <h2>{s.task.prompt}</h2>
              <details className="rubric-details">
                <summary>What a strong response includes</summary>
                <ul>{(s.task.rubric || ['Address each part of the question.', 'Explain the reasoning behind your answer.']).map(r => <li key={r}>{r}</li>)}</ul>
                {!s.task.rubric && <p>The detailed scoring criteria appear after your attempt.</p>}
              </details>

              {(!latest || retry) ? (
                <>
                  {/* Diverse Question Format Switcher */}
                  <div className="format-switcher-row">
                    <span>Question Format:</span>
                    <div className="format-pills" role="tablist" aria-label="Practice Question Format">
                      <button
                        type="button"
                        className={`format-pill ${selectedFormat === 'mcq' ? 'active' : ''}`}
                        onClick={() => { setSelectedFormat('mcq'); if (s.task?.mcqOptions?.[0]) setDraft(s.task.mcqOptions[0]); }}
                      >
                        🔘 Multiple Choice
                      </button>
                      <button
                        type="button"
                        className={`format-pill ${selectedFormat === 'fill-blank' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedFormat('fill-blank');
                          if (s.task?.blankTemplate) {
                            setDraft(s.task.blankTemplate.replace(/\[(.*?)\]/g, '$1'));
                          }
                        }}
                      >
                        ✏️ Fill in Blank
                      </button>
                      <button
                        type="button"
                        className={`format-pill ${selectedFormat === 'matching' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedFormat('matching');
                          if (s.task?.matchingPairs) {
                            setDraft(s.task.matchingPairs.map(p => `${p.left} -> ${p.right}`).join('; '));
                          }
                        }}
                      >
                        🔗 Matching
                      </button>
                      <button
                        type="button"
                        className={`format-pill ${selectedFormat === 'frq' ? 'active' : ''}`}
                        onClick={() => setSelectedFormat('frq')}
                      >
                        📝 Free Response
                      </button>
                    </div>
                  </div>

                  {/* MCQ Interactive Option List */}
                  {selectedFormat === 'mcq' && s.task.mcqOptions && (
                    <div className="interactive-mcq-grid" role="radiogroup" aria-label="Multiple Choice Options">
                      {s.task.mcqOptions.map((opt, oIdx) => {
                        const isSelected = draft === opt;
                        return (
                          <div
                            key={oIdx}
                            className={`interactive-mcq-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => setDraft(opt)}
                          >
                            <span className="option-letter-box">{'ABCD'[oIdx]}</span>
                            <span>{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Fill-in-the-blank Interactive Box */}
                  {selectedFormat === 'fill-blank' && s.task.blankTemplate && (
                    <div className="interactive-blank-box">
                      <p className="blank-template-text">
                        {s.task.blankTemplate.split(/\[.*?\]/).map((part, pIdx, arr) => (
                          <span key={pIdx}>
                            {part}
                            {pIdx < arr.length - 1 && <span className="blank-highlight">_____</span>}
                          </span>
                        ))}
                      </p>
                      <div className="blank-input-row">
                        <input
                          className="blank-input-field"
                          placeholder="Type response to fill in the missing concept..."
                          value={draft}
                          disabled={!!busy}
                          onChange={e => setDraft(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Matching Interactive Columns */}
                  {selectedFormat === 'matching' && s.task.matchingPairs && (
                    <div className="interactive-matching-box">
                      <div className="interactive-matching-grid">
                        <div className="matching-column">
                          <span className="matching-column-title">CONCEPTS / STEPS</span>
                          {s.task.matchingPairs.map((p, pIdx) => {
                            const isSelected = selectedLeft === pIdx;
                            const isMatched = matches[pIdx] !== undefined;
                            return (
                              <div
                                key={pIdx}
                                className={`matching-card ${isSelected ? 'selected' : ''} ${isMatched ? 'matched' : ''}`}
                                onClick={() => setSelectedLeft(pIdx)}
                              >
                                {p.left} {isMatched && '✓'}
                              </div>
                            );
                          })}
                        </div>
                        <div className="matching-column">
                          <span className="matching-column-title">OUTCOMES / DEFINITIONS</span>
                          {s.task.matchingPairs.map((p, pIdx) => {
                            const matchedLeftIdx = Object.entries(matches).find(([_, r]) => r === pIdx)?.[0];
                            const isMatched = matchedLeftIdx !== undefined;
                            return (
                              <div
                                key={pIdx}
                                className={`matching-card ${isMatched ? 'matched' : ''}`}
                                onClick={() => {
                                  if (selectedLeft !== null) {
                                    const newMatches = { ...matches, [selectedLeft]: pIdx };
                                    setMatches(newMatches);
                                    setSelectedLeft(null);
                                    const pairsText = Object.entries(newMatches)
                                      .map(([l, r]) => `${s.task?.matchingPairs?.[Number(l)]?.left} matches ${s.task?.matchingPairs?.[r]?.right}`)
                                      .join('; ');
                                    setDraft(pairsText);
                                  }
                                }}
                              >
                                {p.right} {isMatched && '✓'}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="matching-status-bar">
                        <span>Click a left card then a right card ({Object.keys(matches).length} of {s.task.matchingPairs.length} matched).</span>
                        {Object.keys(matches).length > 0 && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => { setMatches({}); setSelectedLeft(null); setDraft(''); }}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Single Accessible Textarea for Response and Synced Inputs */}
                  <div style={{ marginTop: '14px' }}>
                    <label htmlFor="response" className="field-label">Your thinking</label>
                    <textarea
                      id="response"
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      placeholder={selectedFormat === 'frq' ? 'Work through the idea in your own words…' : 'Selected response or additional reasoning…'}
                      rows={selectedFormat === 'frq' ? 6 : 3}
                      maxLength={4000}
                      disabled={!!busy}
                    />
                    <div className="input-help">{draft.length}/4,000 characters · Reasoning matters more than length.</div>
                  </div>

                  <div className="action-row">
                    <button className="button ghost" disabled={!!busy || !!s.task.hint} onClick={() => request('hint')}>
                      <Lightbulb size={17}/> {s.task.hint ? 'Hint opened' : 'A little hint'}
                    </button>
                    <button
                      className="button primary"
                      disabled={!!busy || draft.trim().length < 8}
                      onClick={() => request('answer', { answer: draft })}
                    >
                      {retry ? 'Submit revision' : 'Get feedback'} <ArrowRight size={17}/>
                    </button>
                  </div>
                </>
              ) : (
                <div className="submitted-answer">
                  <span className="eyebrow">YOUR RESPONSE</span>
                  <p>{latest.answer}</p>
                </div>
              )}
              {s.task.hint && <div className="hint-box"><Lightbulb size={17}/><p>{s.task.hint}</p></div>}
            </section>

            {latest && <section className="card section-card feedback-card">
              <div className="section-top"><h2>{s.mode === 'demo' ? 'Demo feedback · keyword-based' : 'AI feedback · Gemini'}</h2><span className="score-pill">{latest.feedback.score}% rubric score</span></div>
              {!isMastered ? (
                <div className="notice mastery-pending" role="alert">
                  <CircleHelp size={20}/>
                  <div>
                    <strong>Mastery required to advance</strong>
                    <span>Your response did not satisfy all criteria for this cognitive phase ({latest.feedback.score}% score). Bloom&apos;s framework requires solid understanding before progressing to higher-order tasks. Review the feedback below and submit a revision to continue.</span>
                  </div>
                </div>
              ) : (
                <div className="notice mastery-success" role="status">
                  <CheckCircle2 size={20}/>
                  <div>
                    <strong>Mastery demonstrated!</strong>
                    <span>Excellent work. You&apos;ve met the cognitive criteria for {s.task.level} ({latest.feedback.score}% score). You are ready to advance to the next step.</span>
                  </div>
                </div>
              )}
              <p className="body-copy">{latest.feedback.summary}</p>
              <ul className="criteria-list">
                {latest.feedback.criteria.map((c, i) => (
                  <li key={i}>
                    <span className={c.met ? 'met' : 'unmet'}>{c.met ? <CheckCircle2 size={19}/> : <CircleHelp size={19}/>}</span>
                    <div><strong>{c.criterion}</strong><p>{c.feedback}</p></div>
                  </li>
                ))}
              </ul>
              <p className="next-step"><strong>Next step:</strong> {latest.feedback.nextStep}</p>
              <button className="text-button" onClick={() => setShowExample(!showExample)}>
                {showExample ? 'Hide worked example' : 'View worked example'} <ChevronRight size={16}/>
              </button>
              {showExample && <div className="model-answer"><p>{s.task.modelAnswer}</p></div>}
              <div className="action-row">
                <button className="button secondary" disabled={!!busy || retry} onClick={() => { setRetry(true); setDraft(latest.answer); setShowExample(false); }}>
                  <RotateCcw size={15}/>{attempts.length < 3 ? `Try again (${3 - attempts.length} left)` : 'Revise response'}
                </button>
                <button
                  className={`button primary ${!isMastered ? 'disabled-mastery' : 'mastery-ready'}`}
                  disabled={!isMastered || !!busy}
                  title={!isMastered ? 'Demonstrate mastery of this cognitive level before continuing' : undefined}
                  onClick={() => request('next')}
                >
                  {!isMastered && <Lock size={15}/>}
                  {s.taskIndex === 5 ? 'Take final assessment' : 'Continue'}
                  <ArrowRight size={17}/>
                </button>
              </div>
              <p className="input-help">Formative feedback can be wrong. Revisions after viewing an example are practice, not independent assessment.</p>
            </section>}
          </>}

          {s?.stage === 'complete' && s.final && s.diagnostic && <>
            <div className="completion-icon"><Flower2 size={45} strokeWidth={1.3}/></div>
            <div className="page-heading compact">
              <span className="kicker">SESSION COMPLETE</span>
              <h1 ref={headingRef} tabIndex={-1}>Look what <em>took root.</em></h1>
              <p>You’ve practiced all six levels of Bloom’s taxonomy. Here’s your progress today.</p>
            </div>
            <div className="score-comparison">
              <div><span>Your starting point</span><strong>{s.diagnostic.score}<small>%</small></strong><p>Diagnostic · 6 questions</p></div>
              <ArrowRight size={28}/>
              <div><span>After your session</span><strong>{s.final.score}<small>%</small></strong><p>Final assessment · 6 fresh questions</p></div>
              <span className="growth-pill">{s.final.score - s.diagnostic.score > 0 ? '+' : ''}{s.final.score - s.diagnostic.score} percentage points</span>
            </div>
            <div className="notice"><Sprout size={21}/><span>A short quiz indicates progress, not proof of mastery. Question variation, guessing, and a small sample can affect scores. Revisit these ideas later and try unfamiliar problems.</span></div>
            <Performance result={s.final} before={s.diagnostic}/>
            <section className="card section-card">
              <h2>Keep the momentum.</h2>
              <ul className="recommendations">
                {[...s.final.topics].sort((a, b) => a.score - b.score).slice(0, 3).map(t => (
                  <li key={t.id}>
                    <span className="soft-icon"><Leaf size={17}/></span>
                    <div>
                      <strong>{t.name}</strong>
                      <p>{t.score < 100 ? `Review the missed ${t.total - t.correct} question${t.total - t.correct === 1 ? '' : 's'}, explain the reasoning without notes, then solve a new example tomorrow.` : 'Try an unfamiliar problem and explain your reasoning without notes in two days.'}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <button className="button primary" onClick={() => setConfirmClear(true)}>Start a new session <Plus size={16}/></button>
            </section>
            <Review result={s.final} session={s}/>
          </>}
        </>}
        <footer className="main-footer"><span><Flower2 size={13}/> BLOOM</span><span>Small steps. Deeper understanding.</span></footer>
      </main>
    </div>
    {confirmClear && <div className="modal-backdrop"><section className="modal card" role="dialog" aria-modal="true" aria-labelledby="clear-title" onKeyDown={e => { if (e.key === 'Escape') setConfirmClear(false); if (e.key === 'Tab') { const buttons = e.currentTarget.querySelectorAll('button'); if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons[1].focus(); } else if (!e.shiftKey && document.activeElement === buttons[1]) { e.preventDefault(); buttons[0].focus(); } } }}><span className="soft-icon"><Trash2 size={22}/></span><h2 id="clear-title">Make space for a new session?</h2><p>This clears your saved session, responses, and materials from this browser. It cannot be undone. It does not delete data already sent to Gemini.</p><div className="action-row"><button autoFocus className="button secondary" onClick={() => setConfirmClear(false)}>Keep studying</button><button className="button primary" onClick={clear}>Clear saved data</button></div></section></div>}
  </div>;
}

function SequentialLectureMap({ session, currentTopicId }: { session: PublicSession; currentTopicId?: string }) {
  const orderedTopics = [...(session.analysis.topics || [])].sort((a, b) => (a.lectureOrder || 0) - (b.lectureOrder || 0));
  const activeIdx = orderedTopics.findIndex(t => t.id === currentTopicId);

  return (
    <div className="lecture-map-container" aria-label="Sequential Topic Learning Map">
      <div className="lecture-map-header">
        <h3><Layers size={18}/> Sequential Lecture Syllabus Map</h3>
        <span className="pill">{orderedTopics.length} Chronological Modules</span>
      </div>

      <div className="single-topic-banner">
        <ShieldCheck size={16}/>
        <span><strong>Single-Topic Focus Constraint:</strong> Students master one topic deeply before progressing down the syllabus. Chronological order ensures complex topics build on foundational principles.</span>
      </div>

      <div className="lecture-timeline">
        {orderedTopics.map((t, idx) => {
          const isCompleted = activeIdx !== -1 && idx < activeIdx;
          const isActive = idx === activeIdx || (activeIdx === -1 && idx === 0);
          const isLocked = activeIdx !== -1 && idx > activeIdx;

          return (
            <div
              key={t.id}
              className={`lecture-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}`}
            >
              <div className="lecture-node-top">
                <span className="lecture-order-pill">LECTURE 0{t.lectureOrder || idx + 1}</span>
                <span className={`lecture-status-badge ${isActive ? 'badge-active' : isCompleted ? 'badge-completed' : 'badge-locked'}`}>
                  {isActive ? '🎯 Active Focus' : isCompleted ? '✓ Completed' : '🔒 Locked'}
                </span>
              </div>
              <div>
                <h4>{t.name}</h4>
                <p>{t.objective}</p>
              </div>
              <div className="lecture-weight">
                <span>{t.weight}% syllabus focus</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HomePageView({ onStartSession }: { onStartSession: () => void }) {
  return (
    <div className="home-landing-page">
      <section className="home-hero">
        <span className="kicker"><Leaf size={14}/> COGNITIVE MASTERY FOR LIFELONG LEARNERS</span>
        <h1>A little understanding,<br/><em>every day.</em></h1>
        <p>
          Passive reading and cramming create the illusion of competence. Bloom transforms your study notes, syllabi,
          and textbooks into an active, scaffolded cognitive journey designed for genuine long-term retention.
        </p>
        <div className="home-hero-actions">
          <button className="button primary" onClick={onStartSession}>
            Go to Study Session <ArrowRight size={17}/>
          </button>
        </div>
      </section>

      <section className="home-pillars" aria-label="Core Philosophy Pillars">
        <div className="home-pillar-card">
          <div className="pillar-icon-box"><Target size={20}/></div>
          <h3>Active Retrieval</h3>
          <p>Testing your memory and constructing original reasoning builds resilient neural pathways that passive highlighting never can.</p>
        </div>
        <div className="home-pillar-card">
          <div className="pillar-icon-box"><Layers size={20}/></div>
          <h3>Scaffolded Tiers</h3>
          <p>Learning moves progressively through Bloom’s hierarchy—from basic definitions to complex evaluation and creative synthesis.</p>
        </div>
        <div className="home-pillar-card">
          <div className="pillar-icon-box"><ShieldCheck size={20}/></div>
          <h3>Strict Mastery Gates</h3>
          <p>No moving forward on false confidence. If you miss a concept, you remain on that step to reflect, revise, and solidify understanding.</p>
        </div>
        <div className="home-pillar-card">
          <div className="pillar-icon-box"><Sparkles size={20}/></div>
          <h3>Quantified Gains</h3>
          <p>Compare baseline diagnostic scores against fresh exit evaluations to transparently celebrate your real knowledge acquisition.</p>
        </div>
      </section>

      <section className="home-journey-section">
        <h2>How Bloom Works in Practice</h2>
        <p>A structured 4-step learning cycle tailored to your course materials.</p>
        <div className="home-journey-steps">
          <div className="home-journey-step">
            <span className="home-step-tag">STEP 01</span>
            <h4>Diagnostic Entry Check</h4>
            <p>Start with a focused 6-question MCQ baseline. Bloom analyzes your strengths and pinpoints exactly which ideas need deep attention.</p>
          </div>
          <div className="home-journey-step">
            <span className="home-step-tag">STEP 02</span>
            <h4>Mastery Core Learning</h4>
            <p>Advance through the 6 levels of Bloom’s Taxonomy with diverse question formats (MCQ, fill-in-the-blank, matching, and free response).</p>
          </div>
          <div className="home-journey-step">
            <span className="home-step-tag">STEP 03</span>
            <h4>Exit Evaluation & Growth</h4>
            <p>Conclude each module with fresh, comparable questions. See your before-and-after progress documented topic by topic.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function TaxonomyPageView({ onStartSession }: { onStartSession: () => void }) {
  const tiers = [
    {
      num: 6,
      name: 'Create',
      goal: 'Producing new or original work',
      desc: 'Synthesize disparate concepts, formulate hypotheses, and design novel architectures or algorithms.',
      verbs: 'Design, Construct, Formulate, Author, Compose, Synthesize',
      format: 'System Design, Architecture FRQ'
    },
    {
      num: 5,
      name: 'Evaluate',
      goal: 'Justifying a stand or decision',
      desc: 'Critique assumptions, appraise tradeoffs between competing designs, and defend rigorous decisions.',
      verbs: 'Critique, Defend, Judge, Appraise, Validate, Assess',
      format: 'Edge Case Critique, Trade-off Defense'
    },
    {
      num: 4,
      name: 'Analyze',
      goal: 'Drawing connections among ideas',
      desc: 'Deconstruct systems into components, compare linear vs. logarithmic scaling, and distinguish causes.',
      verbs: 'Differentiate, Organize, Contrast, Attribute, Deconstruct',
      format: 'Analytical MCQ, Comparative FRQ'
    },
    {
      num: 3,
      name: 'Apply',
      goal: 'Using information in new situations',
      desc: 'Implement procedures on concrete inputs, trace pointer updates, and calculate expected outputs.',
      verbs: 'Execute, Implement, Solve, Demonstrate, Operate',
      format: 'Interactive Matching, Execution Tracing'
    },
    {
      num: 2,
      name: 'Understand',
      goal: 'Explaining ideas or concepts',
      desc: 'Construct meaning by paraphrasing principles, translating notation, and clarifying why rules hold.',
      verbs: 'Explain, Paraphrase, Summarize, Classify, Interpret',
      format: 'Fill-in-the-blank, Concept Summary'
    },
    {
      num: 1,
      name: 'Remember',
      goal: 'Recalling facts and basic concepts',
      desc: 'Retrieve definitions, formulas, acronyms, and foundational constraints from memory without aids.',
      verbs: 'Define, Recall, List, State, Identify, Match',
      format: 'Quick Recall MCQ, Vocabulary Match'
    }
  ];

  return (
    <div className="taxonomy-page">
      <section className="taxonomy-hero-card">
        <span className="kicker"><Layers size={14}/> THE COGNITIVE FRAMEWORK</span>
        <h1>Bloom’s Taxonomy:<br/><em>From recall to creation.</em></h1>
        <p>
          Formulated in 1956 by educational psychologist Dr. Benjamin Bloom and revised by Anderson & Krathwohl,
          this cognitive model establishes that meaningful learning builds hierarchically. By mastering each cognitive
          tier before climbing to the next, students avoid cognitive overload and develop durable intellectual mastery.
        </p>
      </section>

      <div className="pyramid-diagram" aria-label="Bloom's Taxonomy Cognitive Pyramid">
        {tiers.map(t => (
          <div key={t.num} className="pyramid-tier">
            <div className="tier-badge-col">
              <span className="tier-level-num">LEVEL 0{t.num}</span>
              <span className="tier-name">{t.name}</span>
            </div>
            <div className="tier-desc-col">
              <h4>{t.goal}</h4>
              <p>{t.desc}</p>
            </div>
            <div className="tier-action-col">
              <strong>ACTION VERBS</strong>
              <div className="tier-verbs">{t.verbs}</div>
              <strong style={{ marginTop: '6px' }}>QUESTION FORMAT</strong>
              <div className="tier-verbs">{t.format}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="taxonomy-science-grid">
        <div className="science-card">
          <h3><Target size={18}/> Eliminating the Illusion of Competence</h3>
          <p>
            When students simply read slides or review flashcards, material looks deceptively familiar.
            Bloom’s hierarchy forces retrieval, critique, and synthesis—revealing real conceptual gaps before high-stakes exams.
          </p>
        </div>
        <div className="science-card">
          <h3><ShieldCheck size={18}/> Scaffolding Working Memory</h3>
          <p>
            Attempting to solve high-level design problems without solid recall creates cognitive overload.
            By enforcing mastery at foundational levels first, working memory remains free for higher-order reasoning.
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        <button className="button primary" onClick={onStartSession}>
          Practice Bloom’s Taxonomy Now <ArrowRight size={17}/>
        </button>
      </div>
    </div>
  );
}

function BloomTaxonomyIntro() {
  return (
    <section className="card bloom-intro-card" aria-labelledby="bloom-intro-heading">
      <div className="bloom-intro-header">
        <div>
          <span className="bloom-intro-badge"><Sparkles size={13}/> EDUCATIONAL PHILOSOPHY</span>
          <h2 id="bloom-intro-heading">Mastery through Bloom’s Taxonomy:<br/><em>A little understanding, every day.</em></h2>
          <p>
            True learning isn’t about cramming disconnected facts—it is a continuous climb from recall to creative application.
            Bloom’s Taxonomy organizes thinking into a scaffolded hierarchy of cognitive phases. Solidifying foundational concepts
            empowers you to tackle unfamiliar challenges, analyze trade-offs, and construct original solutions with confidence.
          </p>
        </div>
      </div>

      <div className="phase-ladder">
        {PHASES.map((p) => (
          <div key={p.phase} className="phase-ladder-card">
            <div className="phase-card-top">
              <span className="phase-num-pill">PHASE 0{p.phase}</span>
              <span className="phase-subpill">{p.levels.length === 1 ? '1 Level' : `${p.levels.length} Levels`}</span>
            </div>
            <div>
              <div className="phase-card-title">{p.title}</div>
              <div className="phase-card-tagline">{p.tagline}</div>
            </div>
            <p className="phase-card-desc">{p.focus}</p>
            <div className="phase-card-subpills">
              {p.levels.map(lvl => (
                <span key={lvl} className="phase-subpill">{lvl}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mastery-rule-callout">
        <ShieldCheck size={22}/>
        <div>
          <strong>Strict Mastery-Based Progression Rule</strong>
          <span>
            Cognitive levels build upon one another. If your response does not yet satisfy the rubric criteria for your current task,
            you will remain on the exact same phase until you demonstrate understanding. Use the formative feedback to revise your thinking—mastery takes root one step at a time.
          </span>
        </div>
      </div>
    </section>
  );
}

function CognitivePhaseTracker({ taskIndex, latestFeedback }: { taskIndex: number; latestFeedback?: Feedback }) {
  const isMastered = isTaskMastered(latestFeedback);

  return (
    <div className="cognitive-phase-tracker" aria-label="Bloom cognitive hierarchy progression">
      {PHASES.map((p) => {
        const isCompleted = p.taskIndices.every(idx => idx < taskIndex);
        const isActive = p.taskIndices.includes(taskIndex);
        const isLocked = p.taskIndices[0] > taskIndex;

        let statusTag = <span className="tracker-status-tag status-locked"><Lock size={10}/> Locked</span>;
        if (isCompleted) {
          statusTag = <span className="tracker-status-tag status-completed"><Check size={10}/> Mastered</span>;
        } else if (isActive) {
          if (latestFeedback) {
            statusTag = isMastered
              ? <span className="tracker-status-tag status-active"><Check size={10}/> Mastered</span>
              : <span className="tracker-status-tag status-revision"><RotateCcw size={10}/> Needs Revision</span>;
          } else {
            statusTag = <span className="tracker-status-tag status-active">Active</span>;
          }
        }

        return (
          <div
            key={p.phase}
            className={`tracker-phase ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
            aria-current={isActive ? 'step' : undefined}
          >
            <div className="tracker-phase-head">
              <span className="tracker-phase-num">PHASE 0{p.phase}</span>
              {statusTag}
            </div>
            <div>
              <div className="tracker-phase-title">{p.title}</div>
              <div className="tracker-phase-tagline">{p.tagline}</div>
            </div>
            <div className="tracker-substeps" title={`${p.levels.join(' & ')} tasks`}>
              {p.taskIndices.map(tIdx => {
                const done = tIdx < taskIndex;
                const current = tIdx === taskIndex;
                return (
                  <span
                    key={tIdx}
                    className={`tracker-substep ${done ? 'done' : ''} ${current ? 'current' : ''}`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Citations({ citations, session }: { citations: Citation[]; session: PublicSession }) {
  return <div className="citations">{citations.map((citation, i) => { const source = session.sources.find(s => s.id === citation.sourceId); return <details key={i}><summary><FileText size={12}/>{source?.filename || 'Source'}{source?.page ? ` · p. ${source.page}` : ''}</summary><blockquote>“{citation.quote}”</blockquote></details>; })}</div>;
}
function Performance({ result, before }: { result: QuizResult; before?: QuizResult }) {
  return <section className="card section-card"><div className="section-top"><h2>{before ? 'Your growth, topic by topic' : 'Your starting point, topic by topic'}</h2><span className="pill">{before ? 'Before → After' : 'Diagnostic'}</span></div><div className="performance-table">{result.topics.map(t => <div className="performance-row" key={t.id}><div><strong>{t.name}</strong><small>{t.correct} of {t.total} correct · {t.score === 100 ? 'Strong on this sample' : 'Room to grow'}</small></div><div className="performance-meter"><div className="meter-track">{before && <span className="meter-before" style={{ width: `${before.topics.find(b => b.id === t.id)?.score || 0}%` }}/>}<span style={{ width: `${t.score}%` }}/></div><span>{before && `${before.topics.find(b => b.id === t.id)?.score}% → `}<strong>{t.score}%</strong></span></div></div>)}</div><p className="input-help">Each topic has only 1–2 questions in the demo; percentages are sensitive to individual answers.</p></section>;
}
function Review({ result, session }: { result: QuizResult; session: PublicSession }) {
  return <section className="card section-card"><h2>Make sense of your answers</h2><div className="review-list">{result.questions.map((q, i) => <details key={q.id}><summary><span className={q.answer === result.answers[i] ? 'met' : 'unmet'}>{q.answer === result.answers[i] ? <CheckCircle2 size={18}/> : <CircleHelp size={18}/>}</span><span>{i + 1}. {q.prompt}</span><ChevronRight size={16}/></summary><div className="review-body"><p><strong>Your answer:</strong> {q.options[result.answers[i]]}</p><p><strong>Correct answer:</strong> {q.options[q.answer]}</p><p>{q.explanation}</p><Citations citations={q.citations} session={session}/></div></details>)}</div></section>;
}
