# Reality Simulator — Dixon-Coles & Monte Carlo Workbench

A React, Vite, TypeScript and Tailwind research prototype for football score probabilities, bookmaker prices and expected value.

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

The matrix is normalized before deriving 1X2, Over/Under 1.5 and 2.5, and BTTS probabilities. Expected value is `probability × decimal odds − 1`. Monte Carlo trials sample scorelines from the corrected matrix; the displayed EV uses the exact model probability rather than the trial estimate.

## Prototype inputs

Fixture rates and bookmaker odds in `src/App.tsx` are illustrative static examples, not live feeds. The half-life control blends those recent-form example rates against their priors. The screenshot intake verifies PNG, JPEG and WebP images before running English Tesseract OCR locally in the browser. Recognized matchups are added to the fixture board and permutation pool; unprinted goal rates default to λ 1.65 / μ 1.15. OCR output and inferred prices should be reviewed before use.

## Custom fixtures and permutations

Add custom fixtures above the fixture board. Home/draw/away prices are entered explicitly; totals and BTTS prices use marked illustrative defaults. Custom goal rates are bounded to 0–2.5 goals per side so the full ρ control range yields valid low-score correction factors. Select up to 14 fixture/market pairs from the board, then generate up to 100 unique, no-replacement combinations with a 4–8 leg fold and confidence/positive-EV filters. Ticket hit probabilities and accumulator prices are products of the selected independent match probabilities and odds; portfolio EV is calculated from those exact values.

The “SportyBet reference codes” queue is intentionally a local demonstration only. It creates cryptographically random `SB-REF-…` reference strings sequentially at 400 ms intervals. They are not issued by SportyBet, are not valid booking codes, and cannot place bets or contact a betting service. CSV/text export contains the current prepared ticket references.

## Security notes

- Vite exposes only `VITE_`-prefixed environment variables to browser code. Treat every such variable as public; do not put credentials or service-role keys in client environment files.
- Betslip images are limited to PNG, JPEG or WebP, checked against their file signatures, limited to 10 MB each and five attachments total. OCR processing runs in a browser worker; image bytes are not uploaded. Tesseract worker and language data are fetched from jsDelivr.
- Pasted notes are control-character filtered and capped at 5,000 characters. Notes and filenames are rendered as text, never as HTML.
- Rates, ρ, half-life, odds and simulation dimensions have engine-side bounds. Monte Carlo runs are capped at 100,000, with total fixture/pick trial budgets, and execute in a module Web Worker.
- Vite dev/preview responses and the static-host `public/_headers` configuration set CSP and browser security headers. Development CSP permits Vite/React Refresh inline scripts and styles for HMR; production CSP permits neither.
- Production builds explicitly disable source maps. Run `npm audit` and inspect the deployment host's response headers as part of release checks.
