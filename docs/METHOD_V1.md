# BTC Positioning Cockpit — Method V1

## Goal
A BTC-only, 4H decision-support system that makes the derivatives positioning state readable in one screen. It is designed to surface research setups, not execute trades.

## Core hypothesis
Crowded leveraged positioning creates forced-order liquidity. Price moves through concentrated liquidity can trigger cascades and squeezes. Public exchange account long/short ratios are used as the primary crowd-positioning proxy; top-trader proxy, open interest, funding and liquidation liquidity validate or invalidate that lens.

The system does **not** assume exchanges or institutions intentionally move price simply to avoid paying retail traders.

## Signal stack
1. Crowd long/short account positioning — primary signal. Public account-ratio feeds include exchange accounts generally; they are not a verified retail-only census.
2. Top-trader account + position ratios — large-trader proxy, not verified institutions.
3. Open interest — leverage build/contraction.
4. Funding — cost/crowding of positioning.
5. Liquidation map/heatmap — modeled forced-liquidity pools above/below price.

## V1 aggregation
`AggregatedCrowdLong = Σ(LongPct_i × OI_i) / Σ(OI_i)`

V1 automatically uses Binance + Bybit when both public feeds are available. Binance provides the continuous historical baseline. Stored snapshots become the canonical cross-exchange history over time.

## Crowd regimes
- CROWD_LONG: aggregated long >= 54%
- CROWD_SHORT: aggregated long <= 46%
- NEUTRAL: 46–54%

Percentile/extremeness is more important than the fixed threshold.

## Crowd extremeness
Calculate percentile rank of long-account ratio in the available historical sample.

`Extremeness = abs(percentile - 50) × 2`

0 = historically central; 100 = historical tail.

## Flip event
A flip is a change between non-neutral regimes. A fresh flip is not an automatic entry. It creates a watch event: inspect persistence over the next 1–2 4H closes and whether validators align.

## CSD — Crowd Smart-Money Divergence proxy
`CSD = TopTraderPositionLong% - AggregatedCrowdLong%`

Positive CSD means the top-trader proxy is more bullish than the crowd. Negative CSD means it is more bearish. CSD is not direct institutional positioning.

## Open interest
Crowd one-sidedness + rising OI means leverage is being added and squeeze/cascade potential strengthens. One-sided positioning + falling OI means leverage is leaving and the thesis weakens.

## Funding
For a potential bullish contrarian setup, negative funding is confirming. For a potential bearish contrarian setup, positive funding is confirming. Cross-exchange/OI-weighted funding is preferred.

## Liquidation path logic
Do not assume price must travel directly to the biggest cluster. Evaluate nearest pool above, nearest pool below, cumulative pool above, cumulative pool below, and distance to each. A closer opposite-side pool can plausibly be swept before a larger farther pool. This is a scenario tree, not a deterministic forecast.

## Scores
Two separate scores are mandatory: Crowd Extremeness and Confirmation. Overall Setup Score prioritizes research; it is not probability of profit.

Starting weights:
- Crowd positioning: 35
- Top-trader proxy: 20
- OI: 15
- Funding: 15
- Liquidations: 15

Weights are provisional until backtested.

## Invalidation
Thesis invalidation is separate from trade-level risk. Core invalidations include crowd positioning unwinding/flipping before expansion, CSD reversing, OI contracting sharply, funding normalizing/reversing materially, and liquidation structure shifting toward the opposite side.

Trade-level stop/size is not automated in V1 and must be based on market structure plus a predefined maximum loss.

## Learning loop
Every 4H snapshot is stored when `DATABASE_URL` is configured. The system later fills 4H/24H/72H forward returns. Similar-pattern retrieval compares current features only with past snapshots.

Backtest questions:
- what happens after flips?
- what happens after 80+/90+ crowd-extreme readings?
- which validator combinations matter?
- what is the forward-return distribution at 4H, 24H, 72H, 7D?
- what threshold/weight changes survive out-of-sample testing?
