import { neon } from "@neondatabase/serverless";
import type { Direction, PatternMatch, Snapshot, StoredSnapshotFeatures } from "@/lib/types";

function sqlClient() { const url = process.env.DATABASE_URL; return url ? neon(url) : null; }

export async function ensureSchema() {
  const sql = sqlClient(); if (!sql) return false;
  await sql`CREATE TABLE IF NOT EXISTS btc_positioning_snapshots (
    id BIGSERIAL PRIMARY KEY, ts BIGINT UNIQUE NOT NULL, price DOUBLE PRECISION NOT NULL,
    setup_direction TEXT NOT NULL, setup_score DOUBLE PRECISION NOT NULL,
    retail_net DOUBLE PRECISION NOT NULL, retail_extremeness DOUBLE PRECISION NOT NULL,
    csd DOUBLE PRECISION, oi_4h DOUBLE PRECISION, funding DOUBLE PRECISION, liq_bias DOUBLE PRECISION,
    payload JSONB NOT NULL, return_4h DOUBLE PRECISION, return_24h DOUBLE PRECISION, return_72h DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW())`;
  return true;
}

function features(s: Snapshot): StoredSnapshotFeatures {
  const above = s.liquidations.clustersAbove.reduce((a, c) => a + c.amount, 0);
  const below = s.liquidations.clustersBelow.reduce((a, c) => a + c.amount, 0);
  return { retailNetPct: s.retail.netPct, retailExtremeness: s.retail.extremeness, csd: s.topTraders.csd, oi4h: s.openInterest.change4hPct, funding: s.funding.rate, liqBias: above || below ? (above - below) / Math.max(above + below, 1) : null };
}

export async function saveSnapshot(s: Snapshot) {
  const sql = sqlClient(); if (!sql) return false; await ensureSchema(); const f = features(s);
  await sql`INSERT INTO btc_positioning_snapshots (ts, price, setup_direction, setup_score, retail_net, retail_extremeness, csd, oi_4h, funding, liq_bias, payload)
    VALUES (${s.timestamp}, ${s.price}, ${s.analysis.direction}, ${s.analysis.setupScore}, ${f.retailNetPct}, ${f.retailExtremeness}, ${f.csd}, ${f.oi4h}, ${f.funding}, ${f.liqBias}, ${JSON.stringify(s)}::jsonb)
    ON CONFLICT (ts) DO UPDATE SET price=EXCLUDED.price, setup_direction=EXCLUDED.setup_direction, setup_score=EXCLUDED.setup_score, retail_net=EXCLUDED.retail_net, retail_extremeness=EXCLUDED.retail_extremeness, csd=EXCLUDED.csd, oi_4h=EXCLUDED.oi_4h, funding=EXCLUDED.funding, liq_bias=EXCLUDED.liq_bias, payload=EXCLUDED.payload`;
  return true;
}

export async function updateForwardReturns(currentPrice: number, nowTs: number) {
  const sql = sqlClient(); if (!sql) return; await ensureSchema(); const graceMs = 5 * 60 * 60 * 1000;
  for (const h of [{ hours: 4, col: "return_4h" }, { hours: 24, col: "return_24h" }, { hours: 72, col: "return_72h" }] as const) {
    const newest = nowTs - h.hours * 60 * 60 * 1000, oldest = newest - graceMs;
    if (h.col === "return_4h") await sql`UPDATE btc_positioning_snapshots SET return_4h=((${currentPrice}-price)/price)*100 WHERE return_4h IS NULL AND ts BETWEEN ${oldest} AND ${newest}`;
    else if (h.col === "return_24h") await sql`UPDATE btc_positioning_snapshots SET return_24h=((${currentPrice}-price)/price)*100 WHERE return_24h IS NULL AND ts BETWEEN ${oldest} AND ${newest}`;
    else await sql`UPDATE btc_positioning_snapshots SET return_72h=((${currentPrice}-price)/price)*100 WHERE return_72h IS NULL AND ts BETWEEN ${oldest} AND ${newest}`;
  }
}

export async function findSimilarPatterns(s: Snapshot, limit = 5): Promise<PatternMatch[]> {
  const sql = sqlClient(); if (!sql) return []; await ensureSchema(); const f = features(s);
  const rows = await sql`SELECT ts, price, setup_direction, return_4h, return_24h, return_72h,
    SQRT(POWER((retail_net-${f.retailNetPct})/20.0,2)+POWER((retail_extremeness-${f.retailExtremeness})/30.0,2)+POWER((COALESCE(csd,0)-${f.csd ?? 0})/25.0,2)+POWER((COALESCE(oi_4h,0)-${f.oi4h ?? 0})/10.0,2)+POWER((COALESCE(funding,0)-${f.funding ?? 0})/0.001,2)+POWER((COALESCE(liq_bias,0)-${f.liqBias ?? 0}),2)) AS distance
    FROM btc_positioning_snapshots WHERE ts < ${s.timestamp - 24 * 60 * 60 * 1000} ORDER BY distance ASC LIMIT ${limit}`;
  return rows.map((r: any) => ({ timestamp: Number(r.ts), distance: Number(r.distance), setupDirection: r.setup_direction as Direction, priceAtSnapshot: Number(r.price), return4h: r.return_4h == null ? null : Number(r.return_4h), return24h: r.return_24h == null ? null : Number(r.return_24h), return72h: r.return_72h == null ? null : Number(r.return_72h) }));
}
