"use client";

import type { Snapshot } from "@/lib/types";

function money(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export default function LiquidationPanel({ s }: { s: Snapshot }) {
  const rows = [...s.liquidations.clustersAbove.slice(0, 4), ...s.liquidations.clustersBelow.slice(0, 4)]
    .sort((a, b) => b.price - a.price);
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <div className="liq-panel">
      {!s.liquidations.available && <div className="callout">Automatic heatmap scoring is disabled until <code>COINGLASS_API_KEY</code> is connected. The dashboard still links you to the manual heatmap.</div>}
      {rows.length > 0 ? rows.map((r) => (
        <div className="liq-row" key={`${r.price}-${r.side}`}>
          <span className="liq-price">${r.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <div className="liq-track"><div className="liq-fill" style={{ width: `${Math.max(6, (r.amount / max) * 100)}%` }} /></div>
          <span className="liq-amt">{money(r.amount)} · {r.distancePct >= 0 ? "+" : ""}{r.distancePct.toFixed(2)}%</span>
        </div>
      )) : <div className="empty-chart">No automated liquidation clusters available.</div>}
      <p className="micro">{s.liquidations.note}</p>
    </div>
  );
}
