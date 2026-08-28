import { detectFlip, classifyRetailRegime, scoreSnapshot } from "@/lib/analysis";
import { findSimilarPatterns, saveSnapshot, updateForwardReturns } from "@/lib/db";
import { pctChange, percentileRank, weightedMean } from "@/lib/math";
import { getBinanceBundle } from "@/lib/providers/binance";
import { getBybitBundle } from "@/lib/providers/bybit";
import { getCoinGlassLiquidations } from "@/lib/providers/coinglass";
import type { ExchangeRetail, Point, Snapshot } from "@/lib/types";

export async function buildSnapshot(opts: { persist?: boolean; includePatterns?: boolean } = {}): Promise<Snapshot> {
  const warnings: string[] = [];
  const [binanceResult, bybitResult] = await Promise.allSettled([getBinanceBundle(), getBybitBundle()]);
  if (binanceResult.status !== "fulfilled") throw new Error(`Primary Binance feed failed: ${binanceResult.reason}`);
  const binance = binanceResult.value;
  const bybit = bybitResult.status === "fulfilled" ? bybitResult.value : null;
  if (!bybit) warnings.push(`Bybit cross-check unavailable: ${String((bybitResult as PromiseRejectedResult).reason)}`);

  const price = binance.price || bybit?.price || 0;
  const bRetail = binance.retail[binance.retail.length - 1];
  const byRetail = bybit?.retail?.[bybit.retail.length - 1];
  if (!bRetail) throw new Error("Binance returned no BTC long/short account data.");
  const bOi = binance.oi[binance.oi.length - 1]?.v ?? 0;
  const byOi = bybit?.oi?.[bybit.oi.length - 1]?.v ?? 0;

  const exchanges: ExchangeRetail[] = [{ exchange: "Binance", longPct: bRetail.longPct, shortPct: bRetail.shortPct, oiUsd: bOi || null, timestamp: bRetail.t }];
  if (byRetail) exchanges.push({ exchange: "Bybit", longPct: byRetail.longPct, shortPct: byRetail.shortPct, oiUsd: byOi || null, timestamp: byRetail.t });

  const aggregatedLongPct = weightedMean(exchanges.map((e) => ({ value: e.longPct, weight: e.oiUsd || 1 }))) ?? bRetail.longPct;
  const aggregatedShortPct = 100 - aggregatedLongPct;
  const retailHistory: Point[] = binance.retail.map((r) => ({ t: r.t, v: r.longPct }));
  const retailValues = retailHistory.map((p) => p.v);
  const currentRetail = retailHistory[retailHistory.length - 1];
  if (!currentRetail) throw new Error("No historical retail/crowd series available.");
  const p4 = retailHistory[retailHistory.length - 2]?.v ?? currentRetail.v;
  const p24 = retailHistory[retailHistory.length - 7]?.v ?? retailHistory[0]?.v ?? currentRetail.v;
  const percentileLong = percentileRank(retailValues, aggregatedLongPct);
  const extremeness = Math.abs(percentileLong - 50) * 2;
  const flip = detectFlip(retailHistory);

  const topAccountCurrent = binance.topAccounts[binance.topAccounts.length - 1];
  const topPositionCurrent = binance.topPositions[binance.topPositions.length - 1];
  const positionLong = topPositionCurrent?.longPct ?? null;
  const csd = positionLong == null ? null : positionLong - aggregatedLongPct;

  const oiHistory = binance.oi;
  const oiCurrent = oiHistory[oiHistory.length - 1];
  const oi4h = oiHistory[oiHistory.length - 2];
  const oi24h = oiHistory[oiHistory.length - 7];
  const oiValues = oiHistory.map((p) => p.v);

  const fundingHistory: Point[] = (bybit?.funding?.length ? bybit.funding : [{ t: Date.now(), v: binance.funding }]).slice(-180);
  const fundingValues = fundingHistory.map((p) => p.v);
  const weightedFunding = weightedMean([{ value: binance.funding, weight: bOi || 1 }, ...(bybit?.funding?.length ? [{ value: bybit.funding[bybit.funding.length - 1].v, weight: byOi || 1 }] : [])]) ?? binance.funding;

  let clustersAbove: Snapshot["liquidations"]["clustersAbove"] = [];
  let clustersBelow: Snapshot["liquidations"]["clustersBelow"] = [];
  let liquidationsAvailable = false;
  try { const cg = await getCoinGlassLiquidations(price); clustersAbove = cg.clustersAbove; clustersBelow = cg.clustersBelow; liquidationsAvailable = true; } catch (e) { warnings.push(`CoinGlass heatmap unavailable: ${String(e)}`); }
  const aboveAmount = clustersAbove.reduce((a, c) => a + c.amount, 0);
  const belowAmount = clustersBelow.reduce((a, c) => a + c.amount, 0);
  const dominantSide: Snapshot["liquidations"]["dominantSide"] = !liquidationsAvailable ? "UNKNOWN" : aboveAmount > belowAmount * 1.15 ? "ABOVE" : belowAmount > aboveAmount * 1.15 ? "BELOW" : "BALANCED";

  const bare: Omit<Snapshot, "analysis"> = {
    timestamp: Date.now(), asset: "BTC", timeframe: "4h", price, priceHistory: binance.priceHistory,
    retail: { exchanges, aggregatedLongPct, aggregatedShortPct, netPct: aggregatedLongPct - aggregatedShortPct, percentile30d: percentileLong, extremeness, change4hPp: aggregatedLongPct - p4, change24hPp: aggregatedLongPct - p24, regime: classifyRetailRegime(aggregatedLongPct), previousRegime: flip.previousRegime, flipped: flip.flipped, flipTimestamp: flip.flipTimestamp, history: retailHistory },
    topTraders: { accountLongPct: topAccountCurrent?.longPct ?? null, positionLongPct: positionLong, positionShortPct: positionLong == null ? null : 100 - positionLong, csd, history: binance.topPositions.map((p) => ({ t: p.t, v: p.longPct })), definition: "Top-trader ratios are exchange-specific proxies for larger/high-balance traders. They are not a verified list of institutions or whales." },
    openInterest: { usd: oiCurrent?.v ?? null, change4hPct: oiCurrent && oi4h ? pctChange(oiCurrent.v, oi4h.v) : null, change24hPct: oiCurrent && oi24h ? pctChange(oiCurrent.v, oi24h.v) : null, percentile30d: oiCurrent ? percentileRank(oiValues, oiCurrent.v) : null, history: oiHistory },
    funding: { rate: weightedFunding, percentile30d: percentileRank(fundingValues, weightedFunding), history: fundingHistory },
    liquidations: { available: liquidationsAvailable, clustersAbove, clustersBelow, dominantSide, note: liquidationsAvailable ? "Heatmap clusters are model-derived estimates of liquidation leverage, not a complete ledger of actual positions." : "Connect a CoinGlass API plan/key for automatic heatmap scoring. Until then, use the source link for manual inspection." },
    sources: [
      { name: "Coinalyze BTC Long/Short", url: "https://coinalyze.net/bitcoin/long-short-ratio/", role: "Manual reference for aggregated account positioning" },
      { name: "CoinGlass BTC Liquidation Heatmap", url: "https://www.coinglass.com/pro/futures/LiquidationHeatMap", role: "Manual liquidation-liquidity inspection" },
      { name: "Binance Futures", url: "https://www.binance.com/en/futures/BTCUSDT", role: "Primary public API: crowd account ratio, top-trader ratios, OI, price, funding" },
      { name: "Bybit Contract Data", url: "https://www.bybit.com/en/markets/contractData", role: "Cross-exchange crowd/OI/funding check" },
      { name: "TradingView BTC", url: "https://www.tradingview.com/symbols/BTCUSD/", role: "4H market-structure confirmation" },
    ], providerWarnings: warnings,
  };

  const analysis = scoreSnapshot(bare); let snapshot: Snapshot = { ...bare, analysis };
  if (opts.persist) { try { await saveSnapshot(snapshot); await updateForwardReturns(price, snapshot.timestamp); } catch (e) { snapshot.providerWarnings.push(`Snapshot persistence unavailable: ${String(e)}`); } }
  if (opts.includePatterns) { try { snapshot.analysis.patternMatches = await findSimilarPatterns(snapshot, 5); } catch (e) { snapshot.providerWarnings.push(`Pattern memory unavailable: ${String(e)}`); } }
  return snapshot;
}
