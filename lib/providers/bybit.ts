const BASE = "https://api.bybit.com";
async function jfetch<T>(path: string): Promise<T> { const r = await fetch(`${BASE}${path}`, { cache: "no-store", signal: AbortSignal.timeout(9000) }); if (!r.ok) throw new Error(`Bybit ${r.status}: ${await r.text()}`); const body = (await r.json()) as T & { retCode?: number; retMsg?: string }; if ((body as any).retCode && (body as any).retCode !== 0) throw new Error(`Bybit ${(body as any).retCode}: ${(body as any).retMsg}`); return body; }
export async function getBybitBundle() {
  const [ratio, oi, funding, ticker] = await Promise.all([
    jfetch<any>("/v5/market/account-ratio?category=linear&symbol=BTCUSDT&period=4h&limit=180"),
    jfetch<any>("/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=4h&limit=180"),
    jfetch<any>("/v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=180"),
    jfetch<any>("/v5/market/tickers?category=linear&symbol=BTCUSDT"),
  ]);
  const price = Number(ticker.result?.list?.[0]?.markPrice || ticker.result?.list?.[0]?.lastPrice || 0);
  const retail = (ratio.result?.list || []).map((r: any) => ({ t: Number(r.timestamp), longPct: Number(r.buyRatio) * 100, shortPct: Number(r.sellRatio) * 100 })).sort((a: any, b: any) => a.t - b.t);
  const oiRows = (oi.result?.list || []).map((r: any) => ({ t: Number(r.timestamp), v: Number(r.openInterest) * price })).sort((a: any, b: any) => a.t - b.t);
  const fundingRows = (funding.result?.list || []).map((r: any) => ({ t: Number(r.fundingRateTimestamp), v: Number(r.fundingRate) })).sort((a: any, b: any) => a.t - b.t);
  return { retail, oi: oiRows, funding: fundingRows, price };
}
