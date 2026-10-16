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

## Prototype inputs

Fixture rates and bookmaker odds in `src/App.tsx` are illustrative static examples, not live feeds. The half-life control blends those recent-form example rates against their priors. Add a fixture from the board to the round lineup, or add a custom fixture directly; both can remain selected across consecutive rounds. The screenshot intake verifies PNG, JPEG and WebP images before running English Tesseract OCR locally in the browser. Recognized inline or stacked matchups, 1X2, totals and BTTS prices are added to the fixture board and round lineup; unprinted goal rates default to λ 1.65 / μ 1.15. Per-image OCR status and raw text are available for review; OCR output and inferred prices should be checked before use.

Each generated round shows the simulated score, result, goal totals and GG/NG outcome for every selected match. “Copy Round Outcomes” copies the round label and all match outcomes as plain text. The round lineup stays in place until fixtures are removed or the lineup is cleared.

## Custom fixtures

Add custom fixtures above the fixture board. Home/draw/away prices are entered explicitly; totals and BTTS prices use marked illustrative defaults. Custom goal rates are bounded to 0–2.5 goals per side so the full ρ control range yields valid low-score correction factors. Adding a custom match places it directly into the round lineup, where generated outcomes can be copied as plain text for use elsewhere.

## Security notes

- The workbench passcode is verified against a salted SHA-256 digest and an unlocked flag is remembered in localStorage. This is a client-side privacy gate only, not authentication or access control: users can inspect or modify a client bundle and localStorage. Use server-side authentication to protect sensitive data.
- Vite exposes only `VITE_`-prefixed environment variables to browser code. Treat every such variable as public; do not put credentials or service-role keys in client environment files.
- Betslip images are limited to PNG, JPEG or WebP, checked against their file signatures, limited to 10 MB each and five attachments total. OCR processing runs in a same-origin browser worker; image bytes are not uploaded. The pinned Tesseract.js 7.0.0 worker/core and `@tesseract.js-data/eng` 1.0.0 language model are served from `public/ocr`, avoiding runtime CDN/CORS dependencies. If worker, WASM or language initialization fails, the intake shows the OCR error details.
- Pasted notes are control-character filtered and capped at 5,000 characters. Notes and filenames are rendered as text, never as HTML.
- Rates, ρ, half-life, odds and simulation dimensions have engine-side bounds. Monte Carlo runs are capped at 100,000, with total fixture/pick trial budgets, and execute in a module Web Worker.
- Vite dev/preview responses, `vercel.json`, and the static-host `public/_headers` configuration set CSP and browser security headers. CSP allows WebAssembly compilation with `wasm-unsafe-eval`; it does not allow general `unsafe-eval`. Development CSP permits Vite/React Refresh inline scripts and styles for HMR; production CSP permits neither.
- Production builds explicitly disable source maps. Run `npm audit` and inspect the deployment host's response headers as part of release checks.
