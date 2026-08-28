# BTC Positioning Cockpit

BTC-only 4H derivatives positioning cockpit for `trading.skralovnik.com`.

## What is already implemented
- one-screen five-signal stack,
- Binance + Bybit crowd-account long/short cross-check (used as a retail/crowd proxy),
- OI-weighted current retail aggregation,
- retail percentile/extremeness + regime flip detection,
- Binance top-trader account + position ratios,
- CSD divergence,
- OI 4H/24H change,
- cross-exchange funding where available,
- optional CoinGlass liquidation heatmap clustering,
- Crowd Extremeness + Confirmation + Setup scores,
- thesis invalidation checklist,
- "Analyze right now" live refresh,
- optional Neon snapshot memory + similar historical states,
- optional AI research copilot,
- Vercel 4H cron snapshot scaffold.

## Run locally
```bash
cp .env.example .env.local
npm install
npm run dev
```
Open: `http://localhost:3000`

## Vercel
This repository is designed as a **standalone Vercel project** served from the root of `trading.skralovnik.com`.

Recommended setup:
1. Import `Skralo/trading` as a new Vercel project.
2. Attach the custom domain `trading.skralovnik.com` to that Vercel project.
3. Add the environment variables listed below.

The app itself runs at `/`, API routes at `/api/*`, and the scheduled snapshot route at `/api/cron/snapshot`.

### Persistence
Do not use SQLite on Vercel; serverless local files are ephemeral. Connect Neon Postgres (or another Vercel Marketplace Postgres provider) and set `DATABASE_URL`.

### Optional environment variables
- `COINGLASS_API_KEY` — automatic liquidation heatmap scoring; availability depends on CoinGlass plan.
- `COINALYZE_API_KEY` — reserved for additional cross-check/history expansion.
- `DATABASE_URL` — Neon Postgres historical memory.
- `OPENAI_API_KEY` — AI copilot.
- `OPENAI_MODEL` — defaults to `gpt-5.4`.
- `CRON_SECRET` — protect cron route.

## Data caveats
- Public account long/short feeds are used as a crowd/retail proxy; they are not a verified retail-only census.
- Top-trader ratios are not a list of institutions.
- Liquidation heatmaps are model-derived estimates.
- Exchange APIs can fail, change, rate-limit or differ in methodology.
- Setup score is confluence, not probability of profit.
- V1 is a research hypothesis until backtested.
