import type { Point } from "@/lib/types";

export default function Sparkline({ points, height = 84 }: { points: Point[]; height?: number }) {
  if (!points?.length) return <div className="empty-chart">No history</div>;
  const vals = points.map((p) => p.v).filter(Number.isFinite);
  if (!vals.length) return <div className="empty-chart">No history</div>;
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const width = 320;
  const d = points.map((p, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * width;
    const y = height - ((p.v - min) / span) * (height - 8) - 4;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
