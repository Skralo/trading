import type { Point } from "@/lib/types";

const BASE = "https://fapi.binance.com";
async function jfetch<T>(path: string): Promise<T> { const r = await fetch(`${BASE}${path}`, { cache: "no-store", signal: AbortSignal.timeout(9000) }); if (!r.ok) throw new Error(`Binance ${r.status}: ${await r.text()}`); return r.json() as Promise<T>; }
type RatioRow = { symbol: string; longShortRatio: string; longAccount: string; shortAccount: string; timestamp: number; };
type OIRow = { symbol: string; sumOpenInterest: string; sumOpenInterestValue: string; timestamp: number; };
type TopPositionRow = { symbol: string; longShortRatio: string; longAccount?: string; shortAccount?: string; longPosition?: string; shortPosition?: string; timestamp: number; };

export async function getBinanceBundle() {
  const [retail, topAccounts, topPositions, oi, premium, klines] = await Promise.all([
    jfetch<RatioRow[]>("/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=4h&limit=180"),
    jfetch<RatioRow[]>("/futures/data/topLongShortAccountRatio?symbol=BTCUSDT&period=4h&limit=180"),
    jfetch<TopPositionRow[]>("/futures/data/topLongShortPositionRatio?symbol=BTCUSDT&period=4h&limit=180"),
    jfetch<OIRow[]>("/futures/data/openInterestHist?symbol=BTCUSDT&period=4h&limit=180"),
    jfetch<{ markPrice: string; lastFundingRate: string; time: number }>("/fapi/v1/premiumIndex?symbol=BTCUSDT"),
    jfetch<(string | number)[][]>("/fapi/v1/klines?symbol=BTCUSDT&interval=4h&limit=180"),
  ]);
  const normalizeRetail = retail.map((r) => ({ t: Number(r.timestamp), longPct: Number(r.longAccount) * 100, shortPct: Number(r.shortAccount) * 100 }));
  const normalizeTopAccounts = topAccounts.map((r) => ({ t: Number(r.timestamp), longPct: Number(r.longAccount) * 100, shortPct: Number(r.shortAccount) * 100 }));
  const normalizeTopPositions = topPositions.map((r) => { const ratio = Number(r.longShortRatio); const longFromRatio = Number.isFinite(ratio) ? (ratio / (1 + ratio)) * 100 : NaN; const long = r.longAccount != null ? Number(r.longAccount) * 100 : r.longPosition != null ? Number(r.longPosition) * 100 : longFromRatio; return { t: Number(r.timestamp), longPct: long, shortPct: 100 - long }; });
  const normalizeOi = oi.map((r) => ({ t: Number(r.timestamp), v: Number(r.sumOpenInterestValue) }));
  const priceHistory: Point[] = klines.map((k) => ({ t: Number(k[0]), v: Number(k[4]) }));
  return { retail: normalizeRetail, topAccounts: normalizeTopAccounts, topPositions: normalizeTopPositions, oi: normalizeOi, price: Number(premium.markPrice), funding: Number(premium.lastFundingRate), priceHistory };
}
