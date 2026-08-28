import type { LiquidationCluster } from "@/lib/types";
const BASE = "https://open-api-v4.coinglass.com";
export async function getCoinGlassLiquidations(price: number): Promise<{ clustersAbove: LiquidationCluster[]; clustersBelow: LiquidationCluster[]; }> {
  const key = process.env.COINGLASS_API_KEY; if (!key) throw new Error("COINGLASS_API_KEY not configured");
  const r = await fetch(`${BASE}/api/futures/liquidation/aggregated-heatmap/model3?symbol=BTC&range=7d`, { headers: { "CG-API-KEY": key }, cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`CoinGlass ${r.status}: ${await r.text()}`); const body = await r.json(); if (body.code !== "0") throw new Error(`CoinGlass: ${body.msg || "unknown error"}`);
  const y: number[] = (body.data?.y_axis || []).map(Number); const sparse: [number, number, number][] = body.data?.liquidation_leverage_data || []; const sums = new Map<number, number>();
  for (const row of sparse) { const yIndex = Number(row[1]); const amount = Number(row[2]); sums.set(yIndex, (sums.get(yIndex) || 0) + amount); }
  const clusters = [...sums.entries()].map(([idx, amount]) => ({ level: y[idx], amount })).filter((x) => Number.isFinite(x.level) && Number.isFinite(x.amount) && x.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 50).map((x): LiquidationCluster => ({ price: x.level, amount: x.amount, side: x.level >= price ? "SHORT_LIQUIDATIONS_ABOVE" : "LONG_LIQUIDATIONS_BELOW", distancePct: ((x.level - price) / price) * 100 }));
  return { clustersAbove: clusters.filter((c) => c.price >= price).sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct)).slice(0, 6), clustersBelow: clusters.filter((c) => c.price < price).sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct)).slice(0, 6) };
}
