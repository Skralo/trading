"use client";

import { useEffect, useMemo, useState } from "react";
import type { Snapshot } from "@/lib/types";
import MetricRow from "./MetricRow";
import LiquidationPanel from "./LiquidationPanel";
import Copilot from "./Copilot";
import Sparkline from "./Sparkline";

function formatUsd(v: number | null) {
  if (v == null) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

export default function Cockpit() {
  const [s, setS] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/snapshot", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Snapshot failed");
      setS(j);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  const directionLabel = useMemo(() => {
    if (!s) return "—";
    return s.analysis.direction === "NEUTRAL" ? "NO CLEAR CONTRARIAN BIAS" : `POTENTIAL ${s.analysis.direction}`;
  }, [s]);

  if (!s && loading) return <main className="shell"><div className="loading">Loading live BTC 4H positioning…</div></main>;
  if (!s) return <main className="shell"><div className="error">{error || "No data"}<button onClick={refresh}>Retry</button></div></main>;

  return (
    <main className="shell">
      <header className="topbar">
        <div><span className="eyebrow">SKRALOVNIK / TRADING</span><h1>BTC Positioning Cockpit</h1></div>
        <div className="top-actions"><span className="timestamp">{new Date(s.timestamp).toLocaleString()}</span><button className="primary-btn" onClick={refresh} disabled={loading}>{loading ? "Refreshing…" : "Analyze right now"}</button></div>
      </header>

      <section className="hero-card">
        <div className="hero-main">
          <div className="section-label">4H RESEARCH STATE</div>
          <div className="bias">{directionLabel}</div>
          <p>{s.analysis.thesis}</p>
        </div>
        <div className="hero-price"><span>BTC</span><strong>${s.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong><Sparkline points={s.priceHistory} height={70} /></div>
        <div className="score-card"><span>SETUP</span><strong>{s.analysis.setupScore}</strong><small>{s.analysis.setupState.replaceAll("_", " ")}</small></div>
      </section>

      <section className="score-pair">
        <div><span>CROWD EXTREMENESS</span><strong>{s.analysis.crowdExtremenessScore}</strong><div className="score-track"><i style={{ width: `${s.analysis.crowdExtremenessScore}%` }} /></div></div>
        <div><span>CONFIRMATION</span><strong>{s.analysis.confirmationScore}</strong><div className="score-track"><i style={{ width: `${s.analysis.confirmationScore}%` }} /></div></div>
      </section>

      {s.retail.flipped && <section className="flip-alert"><span>REGIME FLIP</span><strong>Retail crowd regime recently changed.</strong><p>Previous: {s.retail.previousRegime?.replace("CROWD_", "")} → Current: {s.retail.regime.replace("CROWD_", "")}. Treat this as a research event and verify persistence on the next 4H closes.</p></section>}

      <div className="stack-label">FIVE-SIGNAL STACK · SAME 4H LENS</div>

      <MetricRow index={1} title="Retail positioning" value={`${s.retail.aggregatedLongPct.toFixed(1)}% LONG / ${s.retail.aggregatedShortPct.toFixed(1)}% SHORT`} sub={`OI-weighted across ${s.retail.exchanges.map((e) => e.exchange).join(" + ")}`} points={s.retail.history} metric={s.analysis.metrics.retail}>
        <div className="exchange-list">{s.retail.exchanges.map((e) => <span key={e.exchange}>{e.exchange}: {e.longPct.toFixed(1)}L / {e.shortPct.toFixed(1)}S</span>)}</div>
      </MetricRow>

      <MetricRow index={2} title="Top-trader proxy" value={`CSD ${s.topTraders.csd == null ? "—" : `${s.topTraders.csd >= 0 ? "+" : ""}${s.topTraders.csd.toFixed(1)} pp`}`} sub={`Top position long ${s.topTraders.positionLongPct?.toFixed(1) ?? "—"}% · account long ${s.topTraders.accountLongPct?.toFixed(1) ?? "—"}%`} points={s.topTraders.history} metric={s.analysis.metrics.topTraders}>
        <p className="micro">{s.topTraders.definition}</p>
      </MetricRow>

      <MetricRow index={3} title="Open interest" value={formatUsd(s.openInterest.usd)} sub={`4H ${s.openInterest.change4hPct == null ? "—" : `${s.openInterest.change4hPct >= 0 ? "+" : ""}${s.openInterest.change4hPct.toFixed(2)}%`} · 24H ${s.openInterest.change24hPct == null ? "—" : `${s.openInterest.change24hPct >= 0 ? "+" : ""}${s.openInterest.change24hPct.toFixed(2)}%`}`} points={s.openInterest.history} metric={s.analysis.metrics.openInterest} />

      <MetricRow index={4} title="Funding" value={s.funding.rate == null ? "—" : `${(s.funding.rate * 100).toFixed(4)}%`} sub={`Cross-exchange weighted where available · percentile ${s.funding.percentile30d?.toFixed(0) ?? "—"}`} points={s.funding.history} metric={s.analysis.metrics.funding} />

      <MetricRow index={5} title="Liquidation liquidity" value={s.liquidations.dominantSide} sub="Compare nearer sweep vs larger farther pool" points={[]} metric={s.analysis.metrics.liquidations}>
        <LiquidationPanel s={s} />
      </MetricRow>

      <section className="decision-grid">
        <div className="panel"><div className="section-label">THESIS INVALIDATION</div><h2>What would make this setup weaker?</h2>{s.analysis.invalidations.map((x, i) => <div className="check" key={x}><span>{i + 1}</span><p>{x}</p></div>)}</div>
        <div className="panel"><div className="section-label">NEXT CHECKS</div><h2>What to look at next.</h2>{s.analysis.nextChecks.map((x, i) => <div className="check" key={x}><span>{i + 1}</span><p>{x}</p></div>)}</div>
      </section>

      {s.analysis.patternMatches && s.analysis.patternMatches.length > 0 && <section className="patterns panel"><div className="section-label">SIMILAR PAST STATES</div><h2>Nearest stored patterns</h2><div className="pattern-table"><div className="pattern-row head"><span>Date</span><span>Dir</span><span>4H</span><span>24H</span><span>72H</span></div>{s.analysis.patternMatches.map((p) => <div className="pattern-row" key={p.timestamp}><span>{new Date(p.timestamp).toLocaleDateString()}</span><span>{p.setupDirection}</span><span>{p.return4h == null ? "—" : `${p.return4h.toFixed(1)}%`}</span><span>{p.return24h == null ? "—" : `${p.return24h.toFixed(1)}%`}</span><span>{p.return72h == null ? "—" : `${p.return72h.toFixed(1)}%`}</span></div>)}</div></section>}

      <section className="sources panel"><div className="section-label">SOURCE TERMINAL</div><h2>Open the raw charts.</h2><div className="source-grid">{s.sources.map((src) => <a href={src.url} target="_blank" rel="noreferrer" key={src.name}><strong>{src.name}</strong><span>{src.role}</span></a>)}</div></section>

      <Copilot />

      {s.providerWarnings.length > 0 && <details className="warnings"><summary>Provider / setup notes ({s.providerWarnings.length})</summary>{s.providerWarnings.map((w) => <p key={w}>{w}</p>)}</details>}

      <footer>Research decision-support only. Scores express rule confluence, not probability of profit. No automatic execution.</footer>
    </main>
  );
}
