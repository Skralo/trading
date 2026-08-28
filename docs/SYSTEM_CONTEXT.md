# AI-native context design

The app is intentionally structured so an agent can reason over it without scraping the UI.

## Canonical context sources
- `lib/system-context.ts`: durable strategy/rulebook context injected into the copilot.
- Live snapshot JSON from `/api/snapshot`: current machine-readable state.
- `btc_positioning_snapshots` Postgres table: longitudinal memory.
- `docs/METHOD_V1.md`: human-readable canon.

## Snapshot memory
Each saved snapshot contains BTC price and 4H history, exchange-level crowd long/short, OI-weighted aggregate, crowd percentile/extremeness and flip state, top-trader ratios and CSD, OI changes, funding, liquidation cluster summary, scores, invalidations and warnings.

Forward returns are attached later so the system can learn from outcomes rather than narratives.

## AI copilot
`/api/chat` supplies the live snapshot + Method V1 system context to the model. With database memory enabled, the snapshot also includes nearest historical patterns.

Future V2 can add vector retrieval over YouTube transcripts/research notes, CME COT / ETF flow / on-chain whale modules, higher-timeframe structure, automatic rule-learning experiments with walk-forward validation, Telegram alerts, and a trade journal.
