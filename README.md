# Reality Simulator — Dixon–Coles Round Outcome Workbench

A React, Vite, TypeScript and Tailwind research prototype for football score probabilities and simulated match outcomes.

## Run locally

```sh
npm install
npm run dev
```

Use `npm run build` for the production build and `npm run lint` for Oxlint.

## Model

`src/engine/simulation.ts` builds a bivariate Poisson score matrix and applies the Dixon–Coles low-score correction:

- τ(0,0) = 1 − λμρ
- τ(0,1) = 1 + λρ
- τ(1,0) = 1 + μρ
- τ(1,1) = 1 − ρ

The matrix is normalized before deriving 1X2, Over/Under 1.5 and 2.5, and BTTS probabilities. Round generation samples one scoreline from the corrected matrix for each selected fixture and derives the 1X2, totals and both-teams-scored outcomes from that score.

## Fixture generator

The Automated Match Generator requests today's fixtures from the same-origin `/api/fixtures` Vercel serverless endpoint. The endpoint now reads live fixtures from API-Football and enriches each match with recent completed-match scoring streaks for both teams. Configure `API_FOOTBALL_KEY` or `FOOTBALL_API_KEY`; RapidAPI deployments can use `API_FOOTBALL_RAPIDAPI_HOST` plus the RapidAPI key in `API_FOOTBALL_KEY`. If API-Football is unavailable or returns no fixtures, the browser first uses the static fallback pool and then unscheduled registry pairings. Use `vercel dev` to run the serverless endpoint locally.

The endpoint's rate limit and cache are in-memory best-effort protections and may reset when serverless instances restart or scale. Use a shared store such as Redis/KV if a deployment needs globally coordinated limits or caching.

## Media ingestion

The Automated Market Generator also includes a dropzone that accepts a SportyBet screenshot or screen recording from the device. The scanner is admin-only: the dropzone stays locked until the admin key is entered, and `/api/ingest-media` rejects requests without a valid `x-admin-key` header with `401`. The key is verified once via `/api/auth-settings?action=verify-master`, held only in browser memory (never localStorage), and sent as a header on each upload.

The file is posted as `multipart/form-data` to the same-origin `/api/ingest-media` Vercel serverless endpoint (field name `media`, images and videos up to 25 MB). The endpoint runs a two-stage pipeline: a vision stage that turns media into text, then `extractFixturesFromTranscript`, which parses SportyBet IDs, kickoff times, team names and odds into structured fixtures. The vision stage is currently a deterministic stub (`stubVisionTranscript`); replace it with a real OCR/vision engine later — the parser is shared and already final. To exercise the parser directly, post a `text` form field instead of a file. Extracted matches are added to the fixture board and the round lineup. Use `vercel dev` to run the endpoint locally; the hosting platform's request-body limit (~4.5 MB on the Vercel Hobby plan) applies before the function runs.

## Prototype inputs

Fixture rates and bookmaker odds are illustrative model values, not prices supplied by API-Football. The half-life control blends recent-form example rates against their priors. The fixture board contains static examples; the Automated Match Generator can use today's API-Football fixtures when available and otherwise uses unscheduled registry pairings. Add a fixture from the board to the round lineup, or add a custom fixture directly; both can remain selected across consecutive rounds.

Each generated round shows the simulated score, result, goal totals and GG/NG outcome for every selected match. “Generate Round Results” simulates a new round for the current lineup. The round lineup stays in place until fixtures are removed or the lineup is cleared.

## Custom fixtures

Add custom fixtures above the fixture board. Home/draw/away prices are entered explicitly; totals and BTTS prices use marked illustrative defaults. Custom goal rates are bounded to 0–2.5 goals per side so the full ρ control range yields valid low-score correction factors. Adding a custom match places it directly into the round lineup, ready for round generation.

## Security notes

- Optional visitor password protection is managed through the hidden developer-badge admin control and `/api/auth-settings`. Configure the server-only `ADMIN_MASTER_KEY` environment variable; `/api/auth-settings` and `/api/ingest-media` fail closed when it is missing. Set `AUTH_DEFAULT_ACCESS_CODE` if password protection should have an initial visitor code.
- Local scratch scripts, captured API dumps and session files (including SportyBet cookies) live in the git-ignored `.sandbox/` folder. Never commit `.sandbox/` contents or real session credentials.
- Authentication settings use Vercel KV/Upstash when `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`) are configured. Without these bindings settings are stored in per-instance memory and may reset or differ across serverless instances.
- Slip generation requires the server-side `CONVERTBETCODES_API_KEY`. The workflow also accepts `LIVE_CODES_ENDPOINT` (the deployed `/api/live-codes` URL) and `ADMIN_MASTER_KEY` as the `LIVE_CODES_ADMIN_KEY` to persist generated Ghana SportyBet codes. Generated records use KV/Upstash when configured and otherwise remain in the warm function instance.
- Rates, ρ, half-life, odds and simulation dimensions have engine-side bounds. Monte Carlo runs are capped at 100,000, with total fixture/pick trial budgets, and execute in a module Web Worker.
- Vite dev/preview responses, `vercel.json`, and the static-host `public/_headers` configuration set CSP and browser security headers. CSP allows WebAssembly compilation with `wasm-unsafe-eval`; it does not allow general `unsafe-eval`. Development CSP permits Vite/React Refresh inline scripts and styles for HMR; production CSP permits neither.
- Production builds explicitly disable source maps. Run `npm audit` and inspect the deployment host's response headers as part of release checks.
