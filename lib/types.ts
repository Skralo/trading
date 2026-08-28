export type Direction = "LONG" | "SHORT" | "NEUTRAL";
export type CrowdRegime = "CROWD_LONG" | "CROWD_SHORT" | "NEUTRAL";
export type Status = "confirming" | "mixed" | "invalidating" | "unavailable";

export interface Point { t: number; v: number; }
export interface ExchangeRetail { exchange: string; longPct: number; shortPct: number; oiUsd: number | null; timestamp: number; }
export interface LiquidationCluster { price: number; amount: number; side: "LONG_LIQUIDATIONS_BELOW" | "SHORT_LIQUIDATIONS_ABOVE"; distancePct: number; }
export interface SignalMetric { score: number; status: Status; headline: string; detail: string; }

export interface Snapshot {
  timestamp: number; asset: "BTC"; timeframe: "4h"; price: number; priceHistory: Point[];
  retail: { exchanges: ExchangeRetail[]; aggregatedLongPct: number; aggregatedShortPct: number; netPct: number; percentile30d: number; extremeness: number; change4hPp: number; change24hPp: number; regime: CrowdRegime; previousRegime: CrowdRegime | null; flipped: boolean; flipTimestamp: number | null; history: Point[]; };
  topTraders: { accountLongPct: number | null; positionLongPct: number | null; positionShortPct: number | null; csd: number | null; history: Point[]; definition: string; };
  openInterest: { usd: number | null; change4hPct: number | null; change24hPct: number | null; percentile30d: number | null; history: Point[]; };
  funding: { rate: number | null; percentile30d: number | null; history: Point[]; };
  liquidations: { available: boolean; clustersAbove: LiquidationCluster[]; clustersBelow: LiquidationCluster[]; dominantSide: "ABOVE" | "BELOW" | "BALANCED" | "UNKNOWN"; note: string; };
  analysis: { direction: Direction; crowdExtremenessScore: number; confirmationScore: number; setupScore: number; setupState: "NO_SETUP" | "WATCH" | "SETUP" | "HIGH_CONFLUENCE"; metrics: { retail: SignalMetric; topTraders: SignalMetric; openInterest: SignalMetric; funding: SignalMetric; liquidations: SignalMetric; }; thesis: string; invalidations: string[]; nextChecks: string[]; patternMatches?: PatternMatch[]; };
  sources: { name: string; url: string; role: string; }[];
  providerWarnings: string[];
}

export interface StoredSnapshotFeatures { retailNetPct: number; retailExtremeness: number; csd: number | null; oi4h: number | null; funding: number | null; liqBias: number | null; }
export interface PatternMatch { timestamp: number; distance: number; setupDirection: Direction; priceAtSnapshot: number; return4h: number | null; return24h: number | null; return72h: number | null; note?: string | null; }
