import { clamp } from "@/lib/math";
import type { CrowdRegime, Direction, SignalMetric, Snapshot } from "@/lib/types";

function regime(longPct: number): CrowdRegime {
  if (longPct >= 54) return "CROWD_LONG";
  if (longPct <= 46) return "CROWD_SHORT";
  return "NEUTRAL";
}

function metric(score: number, status: SignalMetric["status"], headline: string, detail: string): SignalMetric {
  return { score: Math.round(clamp(score)), status, headline, detail };
}

export function classifyRetailRegime(longPct: number) { return regime(longPct); }

export function detectFlip(history: { t: number; v: number }[]) {
  const regimes = history.map((p) => ({ t: p.t, r: regime(p.v) })).filter((x) => x.r !== "NEUTRAL");
  if (regimes.length < 2) return { flipped: false, previousRegime: null as CrowdRegime | null, flipTimestamp: null as number | null };
  const current = regimes[regimes.length - 1];
  let previousDifferent: typeof current | null = null;
  for (let i = regimes.length - 2; i >= 0; i--) { if (regimes[i].r !== current.r) { previousDifferent = regimes[i]; break; } }
  const recent = previousDifferent && current.t - previousDifferent.t <= 36 * 60 * 60 * 1000;
  return { flipped: Boolean(recent), previousRegime: previousDifferent?.r ?? null, flipTimestamp: recent ? current.t : null };
}

export function scoreSnapshot(s: Omit<Snapshot, "analysis">): Snapshot["analysis"] {
  const crowdShort = s.retail.aggregatedShortPct > s.retail.aggregatedLongPct;
  const direction: Direction = s.retail.extremeness < 45 ? "NEUTRAL" : crowdShort ? "LONG" : "SHORT";
  const dirSign = direction === "LONG" ? 1 : direction === "SHORT" ? -1 : 0;
  const retailScore = s.retail.extremeness;
  const retailMetric = metric(retailScore, retailScore >= 70 ? "confirming" : retailScore >= 45 ? "mixed" : "invalidating", `${s.retail.aggregatedLongPct.toFixed(1)}% long / ${s.retail.aggregatedShortPct.toFixed(1)}% short`, `${s.retail.percentile30d.toFixed(0)}th percentile long-ratio; 4H change ${s.retail.change4hPp >= 0 ? "+" : ""}${s.retail.change4hPp.toFixed(1)} pp.`);

  const csd = s.topTraders.csd;
  const alignedCsd = csd == null || dirSign === 0 ? 0 : csd * dirSign;
  const whaleScore = csd == null ? 35 : clamp(50 + alignedCsd * 2.2);
  const whaleMetric = csd == null ? metric(35, "unavailable", "Top-trader proxy incomplete", "Top position ratio was not available.") : metric(whaleScore, alignedCsd >= 8 ? "confirming" : alignedCsd <= -8 ? "invalidating" : "mixed", `CSD ${csd >= 0 ? "+" : ""}${csd.toFixed(1)} pp`, `Top-position long ${s.topTraders.positionLongPct?.toFixed(1)}% vs crowd long ${s.retail.aggregatedLongPct.toFixed(1)}%. This is a large-trader proxy, not verified institutional positioning.`);

  const oi4h = s.openInterest.change4hPct;
  const oi24h = s.openInterest.change24hPct;
  const oiScore = oi4h == null ? 35 : clamp(50 + oi4h * 7 + (oi24h ?? 0) * 1.5);
  const oiMetric = oi4h == null ? metric(35, "unavailable", "OI unavailable", "Open-interest change could not be calculated.") : metric(oiScore, oi4h >= 1 ? "confirming" : oi4h <= -2 ? "invalidating" : "mixed", `OI ${oi4h >= 0 ? "+" : ""}${oi4h.toFixed(1)}% / 4H`, oi4h > 0 ? "Leverage is building; crowded positioning has more squeeze fuel." : "Leverage is contracting; squeeze fuel may be leaving the market.");

  const funding = s.funding.rate;
  const alignedFunding = funding == null || dirSign === 0 ? 0 : -funding * dirSign;
  const fundingScore = funding == null ? 35 : clamp(50 + alignedFunding * 25000);
  const fundingMetric = funding == null ? metric(35, "unavailable", "Funding unavailable", "No funding reading.") : metric(fundingScore, fundingScore >= 62 ? "confirming" : fundingScore <= 38 ? "invalidating" : "mixed", `${(funding * 100).toFixed(4)}% funding`, `${s.funding.percentile30d?.toFixed(0) ?? "—"}th percentile of the available sample.`);

  const above = s.liquidations.clustersAbove.reduce((a, c) => a + c.amount, 0);
  const below = s.liquidations.clustersBelow.reduce((a, c) => a + c.amount, 0);
  const desired = direction === "LONG" ? above : direction === "SHORT" ? below : 0;
  const opposite = direction === "LONG" ? below : direction === "SHORT" ? above : 0;
  const liqRatio = desired + opposite > 0 ? desired / (desired + opposite) : null;
  const liqScore = liqRatio == null ? 35 : clamp(liqRatio * 100);
  const nearestDesired = direction === "LONG" ? s.liquidations.clustersAbove[0] : s.liquidations.clustersBelow[0];
  const nearestOpposite = direction === "LONG" ? s.liquidations.clustersBelow[0] : s.liquidations.clustersAbove[0];
  const liqMetric = !s.liquidations.available ? metric(35, "unavailable", "Heatmap not connected", "Add a CoinGlass API key to score liquidation clusters automatically.") : metric(liqScore, liqScore >= 60 ? "confirming" : liqScore <= 40 ? "invalidating" : "mixed", `Liquidity bias ${s.liquidations.dominantSide.toLowerCase()}`, `Target-side nearest cluster ${nearestDesired ? `${nearestDesired.distancePct.toFixed(2)}%` : "—"}; opposite-side nearby liquidity ${nearestOpposite ? `${nearestOpposite.distancePct.toFixed(2)}%` : "—"}.`);

  const confirmationScore = Math.round((whaleMetric.score * 20 + oiMetric.score * 15 + fundingMetric.score * 15 + liqMetric.score * 15) / 65);
  const setupScore = Math.round((retailMetric.score * 35 + confirmationScore * 65) / 100);
  const setupState = setupScore >= 78 && retailScore >= 70 ? "HIGH_CONFLUENCE" : setupScore >= 64 && retailScore >= 60 ? "SETUP" : retailScore >= 55 ? "WATCH" : "NO_SETUP";

  const invalidations: string[] = [];
  if (direction === "LONG") {
    invalidations.push("Crowd short positioning materially unwinds or flips to CROWD_LONG before price expands.", "Top-trader CSD reverses negative and remains negative across consecutive 4H snapshots.", "Open interest contracts sharply, removing leverage that supports a squeeze thesis.", "Liquidation map shifts so the larger/closer liquidity pool is below price rather than above.");
  } else if (direction === "SHORT") {
    invalidations.push("Crowd long positioning materially unwinds or flips to CROWD_SHORT before price expands.", "Top-trader CSD reverses positive and remains positive across consecutive 4H snapshots.", "Open interest contracts sharply, removing leveraged-long fuel.", "Liquidation map shifts so the larger/closer liquidity pool is above price rather than below.");
  } else invalidations.push("No directional positioning thesis exists while crowd positioning is neutral.");

  const nextChecks = [
    s.retail.flipped ? "Crowd regime has recently flipped — inspect the next 1–2 four-hour closes for persistence." : "Watch for a crowd regime flip or a move into a historical extreme.",
    "Compare the nearest liquidity pool with the larger, farther pool: a nearer opposite-side sweep can happen before the broader thesis resolves.",
    "Treat the score as a research trigger, not an entry command; pair it with market structure and predefined trade risk.",
  ];

  return { direction, crowdExtremenessScore: Math.round(retailScore), confirmationScore, setupScore, setupState, metrics: { retail: retailMetric, topTraders: whaleMetric, openInterest: oiMetric, funding: fundingMetric, liquidations: liqMetric }, thesis: direction === "NEUTRAL" ? "Crowd positioning is not sufficiently one-sided for the contrarian liquidity thesis to be the primary lens right now." : `Current V1 hypothesis: the crowd is positioned ${direction === "LONG" ? "short" : "long"}; if leverage remains elevated, the market may be vulnerable to a ${direction === "LONG" ? "short squeeze toward liquidity above" : "long squeeze toward liquidity below"}. Other signals are validators, not guarantees.`, invalidations, nextChecks };
}
