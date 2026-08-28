export function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function pctChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function percentileRank(values: number[], current: number) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return 50;
  const below = clean.filter((v) => v < current).length;
  const equal = clean.filter((v) => v === current).length;
  return ((below + equal * 0.5) / clean.length) * 100;
}

export function weightedMean(items: { value: number; weight: number }[]) {
  const clean = items.filter((i) => Number.isFinite(i.value) && Number.isFinite(i.weight) && i.weight > 0);
  const sumWeight = clean.reduce((s, i) => s + i.weight, 0);
  if (!sumWeight) return null;
  return clean.reduce((s, i) => s + i.value * i.weight, 0) / sumWeight;
}
