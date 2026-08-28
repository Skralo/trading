import type { ReactNode } from "react";
import type { Point, SignalMetric } from "@/lib/types";
import Sparkline from "./Sparkline";

export default function MetricRow({ index, title, value, sub, points, metric, children }: {
  index: number; title: string; value: string; sub: string; points: Point[]; metric: SignalMetric; children?: ReactNode;
}) {
  return (
    <section className="metric-row">
      <div className="metric-head">
        <div><span className="metric-index">0{index}</span><h2>{title}</h2></div>
        <span className={`pill ${metric.status}`}>{metric.status}</span>
      </div>
      <div className="metric-grid">
        <div>
          <div className="metric-value">{value}</div>
          <div className="metric-sub">{sub}</div>
          <div className="metric-explain"><strong>{metric.headline}</strong><br />{metric.detail}</div>
          {children}
        </div>
        <div className="metric-chart"><Sparkline points={points} /></div>
        <div className="metric-score"><span>{metric.score}</span><small>/ 100</small></div>
      </div>
    </section>
  );
}
