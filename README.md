# Bloom

A hackathon MVP that turns course materials into a personalized study session using all six levels of Bloom’s taxonomy. Built with Next.js App Router, React, TypeScript, Zod, Gemini’s server-side REST API, and `unpdf` for PDF extraction.

## Run locally

Use **Node.js 22.11+** and npm.

```sh
npm install
```

Copy `.env.example` to `.env.local` if you do not already have one. This workspace has a local, randomly generated session secret; preserve it when adding your Gemini key.

```powershell
# For a fresh clone only (do not overwrite an existing .env.local):
Copy-Item .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the generated value in `SESSION_SECRET` in `.env.local`. Optionally set `GEMINI_API_KEY` using a key from [Google AI Studio](https://aistudio.google.com/apikey). Edit the local file, never browser source or chat. Restart the server after changing environment variables.

```sh
npm run dev
```

Open **http://localhost:3000** and click **Try the CS demo**. The entire demo works without a Gemini key or network access to Gemini. Fonts use Google Fonts when available and fall back to local system fonts.

For a production build:

```sh
npm run build
npm start
```

`SESSION_SECRET` must be set for production. Use a Node.js host; this app needs a server and cannot be deployed as a static export.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-only Gemini API key. Optional for the demo, required for uploaded-material sessions. Never prefix with `NEXT_PUBLIC_`. |
| `GEMINI_MODEL` | Defaults to `gemini-3.5-flash`; choose a model supporting structured JSON output. Gemini 3 uses a low thinking level; Gemini 2 uses a 1,024-token thinking budget. |
| `GEMINI_FALLBACK_MODEL` | Defaults to `gemini-3.1-flash-lite`. Used on the third attempt after temporary provider errors. Set to an empty value to retry only the primary model. |
| `SESSION_SECRET` | Random secret with at least 32 bytes of entropy. Required for production and stable resume across server restarts. Changing it invalidates saved sessions. Development has an ephemeral fallback if omitted. |

## What works

1. **Materials:** subject, up to five PDF/TXT/Markdown resources, pasted notes, and one optional practice exam. Explicit Gemini disclosure and consent. Each file is at most 5 MB; PDFs at most 40 pages; combined extracted text at most 50,000 characters. Course notes must contain at least 400 characters and 60 words independently of the exam. Scanned, locked, unsupported, or unreadable inputs get actionable errors.
2. **Analysis:** concepts, learning objectives, source excerpts, and an assessment blueprint. Practice exams guide inferred coverage, difficulty, and style. No exam means the app uses the source topics to choose coverage. Every generated citation must contain a real source ID and an exact normalized excerpt; PDF references retain actual page numbers.
3. **Diagnostic:** six multiple-choice questions, scores, topic strengths and weaknesses, and explanations after submission. Answer keys remain encrypted and absent from public session data until submission.
4. **Personalized learning:** lowest diagnostic topic score first, with topic weight breaking ties. At least three tasks target the highest-priority topic. The student completes Remember, Understand, Apply, Analyze, Evaluate, and Create in order. Each step includes concise teaching, a rubric, an optional hint, written feedback, and up to two revisions after the first attempt. Model answers are only available after an attempt.
5. **Final assessment:** six fresh questions prepared with the same per-topic counts and difficulty distribution as the diagnostic. Before/after and topic-level results, explanations, and next steps. The interface explicitly describes the quiz as an indication of progress, not proof of mastery.
6. **Persistence:** the current session, drafts, answers, and progress are saved in browser storage. Refresh and choose Resume session. Clear saved data removes this browser’s record. Sessions expire after seven days.

## Architecture

- `app/page.tsx`: responsive cream-and-sage client UI, accessible controls, loading/error states, saved-session handling, complete study flow.
- `app/api/session/route.ts`: one bounded, state-checked API. Handles multipart material ingestion and JSON session actions. Rejects invalid stage transitions and concurrent work for the same session within one server process.
- `lib/materials.ts`: server-only file validation and per-page PDF text extraction.
- `lib/gemini.ts` and `lib/gemini-request.ts`: server-only Gemini calls using the `x-goog-api-key` header, a shared 65-second deadline, structured-output JSON schema derived from Zod, and runtime Zod parsing. Length and array-size constraints are omitted from the provider schema to avoid schema compilation errors; the complete Zod schema still enforces them on every response. Temporary HTTP 500/502/503/504 errors trigger one primary-model retry and then one fallback-model attempt, with exponential backoff and jitter. `Retry-After` is honored within the shared deadline. Quota/authentication errors, invalid output, network exceptions, and timeouts are not automatically retried. See [Gemini structured output documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).
- `lib/schema.ts`: typed content contracts and Zod schemas.
- `lib/engine.ts`: grading, priority calculation, semantic consistency checks, citation verification, public-view projection, AES-256-GCM session encryption/authentication.
- `lib/demo.ts`: complete, original, built-in computer science material, two assessments, and a task bank for all six levels for each topic.

The initial Gemini call analyzes sources and creates both assessments. A second call after diagnostic submission creates the personalized tasks using the actual diagnostic errors. One call grades each learning response. A normal run uses **8 generation operations** (2 generation + 6 feedback); using every revision uses **20 operations**. Each operation makes at most three provider requests, so the bounds including recovery are 24 and 60 requests respectively, excluding manual retries. Hints, resume, quiz grading, and final results make no Gemini calls. Each generation is capped at 18,000 output tokens. A process-local limit caps all API requests at 100 per IP per hour. Quota, authorization, timeout, blocked/truncated output, invalid JSON, unverifiable citations, and inconsistent assessment coverage produce recoverable errors. If automatic recovery fails, the error banner offers **Try again**, which resubmits the same request without requiring the user to re-enter notes, upload files again, or repeat answers. Unsubmitted uploads remain in tab memory, not persistent browser storage.

The server keeps no database or durable material files. Browser storage contains a public progress view and an opaque authenticated encrypted session with source text and unreleased content. Only the server can decrypt it. Completed answers and student responses are visible in the public saved view. Treat a saved session as private browser data; anyone with access to that browser can resume it. The key is not in browser bundles. Requests and materials are not logged by app code.

Uploaded materials, subject text, filenames, and student answers are serialized as data and explicitly treated as untrusted in Gemini’s system instruction. Output is never rendered as HTML. Citation existence and excerpt checks are mechanical; they cannot establish that every generated statement is actually entailed by a source.

## Demo mode

The demo covers data structures, binary search, hash tables, and algorithm complexity. It is labeled throughout as built-in content and never claims to use uploads. Diagnostic and final assessment scoring is deterministic. Written demo feedback uses simple, visible keyword-based rubric checks rather than AI; it may miss valid answers or accept faulty reasoning. Live mode uses Gemini rubric feedback and labels it as AI feedback.

### Short hackathon script (3–5 minutes)

1. Open Bloom and show the materials form and Gemini disclosure.
2. Click **Try the CS demo**. Show its four topics, source references, and coverage blueprint.
3. Take the diagnostic. Choose B, A, A, D, A, D to miss the two binary-search questions (67%).
4. Show binary search at the top of the priority list. Start learning and request a hint.
5. For Remember, write “Sorted data is required; binary search takes O(log n) time.” Submit, inspect the rubric and worked example, and optionally revise.
6. Complete the remaining five tasks, describing your reasoning. Note that Continue is available after an attempt even if feedback identifies gaps.
7. On the final assessment choose B, C, A, D, B, D. Show 67% → 100%, topic progress, explanations, and the small-sample caveat.
8. Refresh and resume the completed session. Use the trash icon to clear local data.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The browser suite uses Chromium. If it is not installed, run `npx playwright install chromium` once. Playwright starts the local development server automatically when port 3000 is free.

Unit tests cover source grounding, PDF page extraction, file limits, missing/invalid AI output, quota and timeout handling with mocked Gemini responses, encrypted-session tampering and expiration, assessment scoring, answer-key hiding, and diagnostic-driven task selection. The browser suite completes the entire demo, including resume, hint, retry, all six learning levels, final comparison, clearing storage, mobile layout, invalid uploads, and invalid API transitions.

**Live Gemini verification:** the locally configured key successfully generated a live source-grounded analysis and paired assessments through Bloom’s API using `gemini-3.5-flash`. Live rubric feedback also passed Zod validation and exact rubric-criterion checks. Gemini rejected the former `gemini-2.5-flash` default for this account, so the default was updated. The full six-task live browser journey has not been completed; the full demo journey is covered by browser tests. Provider availability, latency, and generated quality may vary. The app does not silently fall back to demo content on provider failures.

## MVP limitations

- No login, database, vector store, OCR, payments, or social features. One saved session per browser. Browser storage may be unavailable or full; the UI warns if saving fails.
- The token is stateless. A client can replay an older valid token; per-task attempt counters are UX bounds, not abuse-proof spending limits. The rate limiter and concurrent-request guard are process-local, reset on restart, and are not shared across instances. Do not expose an unrestricted paid key on a public deployment without durable budget/rate controls and a trusted proxy configuration.
- A shared server secret is required across instances. Do not rotate it if you want existing sessions to resume. HTTPS, a deployment request-body limit of 31 MB, and provider billing limits are appropriate for hosted use.
- The request content-length gate and per-file checks protect normal browser uploads; configure a reverse-proxy body limit for adversarial or chunked traffic. PDF text extraction has page/size limits but no hard CPU isolation; untrusted public uploads need worker isolation and processing time limits.
- PDF reading order, formulas, tables, and code indentation may be imperfect. Extracted text only is sent to Gemini; no images or diagrams. Multi-page extraction may omit empty pages as sources while preserving the actual page numbers of text-bearing pages.
- Semantic correctness, practice-exam alignment, nontrivial question freshness, pedagogical quality, and resistance to prompt injection cannot be guaranteed by schema validation. AI feedback is formative and fallible. The app verifies distinct prompts and matching topic/difficulty counts, not psychometric equivalence.
- The final assessment is generated alongside the diagnostic for reliability and a fixed comparison blueprint, then withheld until learning is complete. Only the learning tasks adapt to the diagnostic results.
- Clearing local data does not remove data already sent to Google. Consult your provider’s data handling policy before using confidential course materials.

This workspace was empty at the start; there was no existing application code to reuse.
