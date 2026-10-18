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

The Automated Match Generator requests today's fixtures from the same-origin `/api/fixtures` Vercel serverless endpoint using UTC dates and kickoff times. Configure `FOOTBALL_API_KEY` as a server-side Vercel environment variable; the endpoint forwards it to API-Football and returns only clean fixture fields. It limits each client to 30 requests per minute and caches daily API responses for 15 minutes per warm function instance. The browser keeps only fixtures with status `NS` inside the selected kickoff window. If the server key is missing, the API is unavailable/rate-limited, or no fixtures match the selected window, the generator falls back to unscheduled pairings from the internal club registry. Never prefix the API key with `VITE_` or store it in browser localStorage. Use `vercel dev` to run the serverless endpoint locally.

The endpoint's rate limit and cache are in-memory best-effort protections and may reset when serverless instances restart or scale. Use a shared store such as Redis/KV if a deployment needs globally coordinated limits or caching.

## Prototype inputs

Fixture rates and bookmaker odds are illustrative model values, not prices supplied by API-Football. The half-life control blends recent-form example rates against their priors. The fixture board contains static examples; the Automated Match Generator can use today's API-Football fixtures when available and otherwise uses unscheduled registry pairings. Add a fixture from the board to the round lineup, or add a custom fixture directly; both can remain selected across consecutive rounds.

Each generated round shows the simulated score, result, goal totals and GG/NG outcome for every selected match. “Generate Round Results” simulates a new round for the current lineup. The round lineup stays in place until fixtures are removed or the lineup is cleared.

## Custom fixtures

Add custom fixtures above the fixture board. Home/draw/away prices are entered explicitly; totals and BTTS prices use marked illustrative defaults. Custom goal rates are bounded to 0–2.5 goals per side so the full ρ control range yields valid low-score correction factors. Adding a custom match places it directly into the round lineup, ready for round generation.

## Security notes

- The workbench has no sign-in or access-control gate. Do not put sensitive data in the client; protect sensitive resources with server-side authentication.
- Vite exposes `VITE_`-prefixed environment variables to browser code. Treat every such variable as public; the API-Football credential is server-only as `FOOTBALL_API_KEY`.
- Rates, ρ, half-life, odds and simulation dimensions have engine-side bounds. Monte Carlo runs are capped at 100,000, with total fixture/pick trial budgets, and execute in a module Web Worker.
- Vite dev/preview responses, `vercel.json`, and the static-host `public/_headers` configuration set CSP and browser security headers. CSP allows WebAssembly compilation with `wasm-unsafe-eval`; it does not allow general `unsafe-eval`. Development CSP permits Vite/React Refresh inline scripts and styles for HMR; production CSP permits neither.
- Production builds explicitly disable source maps. Run `npm audit` and inspect the deployment host's response headers as part of release checks.
