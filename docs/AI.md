# AI question generation

Code: `src/lib/server/ai/generate.ts` (prompt, context, validation, providers), `src/lib/server/ai/{input,pdf}.ts`
(text cleaning, budget, PDF text layer), `src/lib/features/ai/schema.ts` (input + question Zod),
`src/lib/features/ai/server/service.ts` (jobs). Benchmark: `bun scripts/ai-bench.ts [--models a,b] [--pdf file.pdf]`.

## Flow

1. `createJob(input, userId)` validates the input, clamps `count` to `AI_MAX_QUESTIONS`, stores an `ai_jobs` row
   (`queued`; PDF bytes are never stored, only `byteSize`) and returns. Generation runs in the same process:
   `running` then `ready` (questions, provider, model, tokens) or `failed` (error text). A job still `running`
   15 minutes later is reported as failed (a restart cut it off). The bank calls `markApplied(id)` once after copying.
2. Providers, in order: `GEMINI_MODEL`, then the Gemini chain `gemini-3-flash-preview`, `gemini-flash-lite-latest`,
   `gemini-3.1-flash-lite`, then OpenRouter (`OPENROUTER_MODEL`). Each is LangChain `withStructuredOutput`
   (Gemini: `ChatGoogleGenerativeAI` response schema; OpenRouter: `ChatOpenAI` with baseURL `https://openrouter.ai/api/v1`,
   strict JSON schema). Any error, 60 s timeout, unparseable output or zero valid questions moves to the next provider.
   No SDK retries on Gemini: a 429 quota error does not clear in seconds, the next model is the retry.
3. Validation per question (Zod): prompt 5-2000 chars, exactly 4 non-empty options, distinct after normalising,
   `correctIndex` 0-3, difficulty easy/medium/hard. Duplicates across chunks are dropped by `fingerprint()`
   (sha256 of the lower-cased prompt without punctuation; also used by the bank). Options are shuffled (models put the
   answer first), numeric sets sorted, "none of the above" kept last. One top-up call asks for the missing count with a
   do-not-repeat list. If nothing valid comes back the job fails: no placeholder questions are ever invented.

## Context engineering (credits)

- PDFs: the text layer (unpdf) only, page range applied, cleaned (headers, footers, page numbers removed), paragraphs
  deduped, budgeted to 120k chars. Only a real scan (no text layer) is sent natively as inline PDF, capped at 20 pages.
- Source first, the short ask last (count, difficulty mix, exam, language, teacher notes): identical prefixes hit the
  provider prompt cache on top-ups.
- Compact output keys `q, o, a, e, t, d` (about 15 output tokens saved per question) and a ~120-word system prompt.
- Output cap `1024 + n * 300` tokens (600 per question for Hindi/bilingual). Thinking set to the minimum per family
  (`thinkingBudget: 0` on 2.5 flash, `thinkingLevel: low` on 3.x), since thinking tokens bill as output.
- Large texts are split into chunks of about 24k chars (at least 5 questions per chunk) run in parallel, the count
  split across them; the system prompt is the only repeated part.
- Measured: 10 topic questions = 230 input tokens; 10 questions from a 4.6k-char PDF text = 1,162 input tokens;
  output 900-1,600 tokens per 10 questions on Gemini.

## Benchmark (2026-10-20, free-tier Gemini key)

Every model the key lists for `generateContent`, minus TTS, image, music, robotics, computer-use, deep-research,
transcribe and omni models. Tasks: (a) 10 questions, topic "Indian National Movement 1905-1947", SSC CGL;
(b) 10 questions from a 4.6k-char text on Fundamental Rights (Part III). Quality judged from 3 sampled questions
per run (easy / medium / hard) checked for factual accuracy, grounding and exam style.

| model | task | latency | valid | in tok | out tok | quality |
|---|---|---|---|---|---|---|
| gemini-3-flash-preview | topic | 7.0s | 10/10 | 230 | 903 | best: precise, real exam-grade hard items (Curzon Wyllie, Annie Besant) |
| gemini-3-flash-preview | pdf | 17.2s | 10/10 | 1162 | 1177 | best: good "NOT" and compare items, fully grounded |
| gemini-flash-lite-latest | topic | 9.2s | 10/10 | 230 | 1306 | good, accurate (Prati Sarkar = Satara) |
| gemini-flash-lite-latest | pdf | 11.6s | 10/10 | 1162 | 1232 | good, grounded, a little easy |
| gemini-3.1-flash-lite | topic | 21.1s | 10/10 | 230 | 1491 | ok, plain recall |
| gemini-3.1-flash-lite | pdf | 9.9s | 10/10 | 1162 | 1483 | ok, grounded, "hard" items are recall |
| gemini-3.1-flash-lite-preview | topic | fail | - | - | - | 429 daily quota |
| gemini-3.1-flash-lite-preview | pdf | 11.1s | 10/10 | 1162 | 1580 | good, grounded |
| gemini-3.5-flash | topic | 18.9s | 10/10 | 230 | 1503 | good (Chauri Chaura, HRA to HSRA) |
| gemini-3.5-flash | pdf | fail | - | - | - | 429 daily quota |
| gemini-3.5-flash-lite | topic | 7.8s | 10/10 | 230 | 1045 | weak: "founder of HSRA = Azad" is disputable |
| gemini-3.5-flash-lite | pdf | 14.0s | 10/10 | 1162 | 1309 | ok, grounded |
| gemini-3.6-flash | topic | 6.3s | 10/10 | 230 | 1046 | rejected: invented a person ("Deshchitt") |
| gemini-3.6-flash | pdf | fail | - | - | - | 429 daily quota |
| gemini-2.5-flash | topic | 8.2s | 10/10 | 230 | 1534 | good (smoke run; later 429) |
| gemini-2.5-flash | pdf | 11.2s | 10/10 | 1162 | 1460 | good, grounded (smoke run; later 429) |
| gemini-flash-latest | topic | 106.3s | 10/10 | 230 | 1202 | good content, one stalled request |
| gemini-flash-latest | pdf | fail | - | - | - | 429 daily quota |
| gemma-4-31b-it | topic | fail | - | - | - | timed out |
| gemma-4-31b-it | pdf | 44.4s | 10/10 | 1162 | 1046 | ok but slow |
| gemma-4-26b-a4b-it | both | fail | - | - | - | unparseable structured output |
| gemini-3.7-flash, gemini-3.8-flash | both | fail | - | - | - | 429: the 20 requests/day free quota was already used |
| gemini-2.5-pro, gemini-pro-latest, gemini-3.1-pro-preview, gemini-4-argon | both | fail | - | - | - | free tier has no quota for these (2.5-pro: 404, "not available to new users") |
| gemini-2.5-flash-lite | both | fail | - | - | - | 404, "not available to new users" |
| OpenRouter `anthropic/claude-haiku-5.5` (fallback) | topic | 17.1s | 10/10 | 863 | 3433 | good and accurate, but about 3x the output tokens |

Extra live checks: the full chain with a bilingual topic (5 questions) succeeded on the fallback model after a stalled
`gemini-3-flash-preview` request (that stall is why the timeout is 60 s, not 120 s). A native (scanned-path) PDF on
`gemini-3-flash-preview` returned 3/3 grounded questions in 6.5 s with 1,268 input tokens.

## Chosen defaults

- Topic to questions: **`gemini-3-flash-preview`**. It had the best quality, was fastest (7 s) and wrote the fewest tokens.
- PDF to questions: **`gemini-3-flash-preview`** (best grounded quality). `gemini-flash-lite-latest` is next in the chain
  (11.6 s, slightly easier items).
- Fallback: OpenRouter `OPENROUTER_MODEL`.
- Lead action: set the `GEMINI_MODEL` default in `src/lib/server/env.ts` to `gemini-3-flash-preview`. The current
  default `gemini-2.5-flash` is still tried first and costs one fast 429 when its quota is used up.

## Open risks

- The key is on the **free tier: 20 requests per day per model**, and pro models get no quota at all. A 10-question job
  is 1 request (more for chunked PDFs and top-ups). The 3-model chain gives about 60 requests a day before OpenRouter
  pays. Enable billing on the Gemini project before launch.
- Scanned PDFs are sent whole (no PDF cutter is installed), so they are refused above 20 pages. Adding `pdf-lib` would
  let us send only the chosen pages.
