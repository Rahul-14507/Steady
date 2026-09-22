import { T } from "../config/thresholds";
import { METRICS } from "./metricsRegistry";
import { mad, median } from "./signal";
import type { MetricKey } from "./types";

export interface Baseline { median: number; scale: number; n: number }

export function computeBaseline(key: MetricKey, values: number[]): Baseline | null {
  const usable = values.filter(Number.isFinite).slice(0, T.baseline.targetSessions);
  if (usable.length < T.baseline.minSessions) return null;
  return { median: median(usable), scale: Math.max(1.4826 * mad(usable), METRICS[key].minScale), n: usable.length };
}

export function zScore(key: MetricKey, current: number, baseline: Baseline) {
  const raw = (current - baseline.median) / baseline.scale;
  const adjusted = METRICS[key].higherIsBetter ? raw : -raw;
  return Math.max(-3, Math.min(3, adjusted));
}

export function trendScore(recent: Partial<Record<MetricKey, number>>, baselines: Partial<Record<MetricKey, Baseline>>) {
  let weightedScore = 0;
  let totalWeight = 0;
  let used = 0;
  for (const key of Object.keys(recent) as MetricKey[]) {
    const current = recent[key];
    const baseline = baselines[key];
    if (current === undefined || !baseline || !Number.isFinite(current)) continue;
    const weight = METRICS[key].weight;
    weightedScore += weight * zScore(key, current, baseline);
    totalWeight += weight;
    used += 1;
  }
  return used ? { score: Math.round(50 + (weightedScore / totalWeight) * (50 / 3)), used } : null;
}

export function trendLabel(score: number) {
  if (score >= T.trend.improveAbove) return "better" as const;
  if (score <= T.trend.declineBelow) return "worse" as const;
  return "similar" as const;
}

export function confidence(validRecentSessions: number, meanQuality: number) {
  return Math.round(Math.min(1, validRecentSessions / 10) * Math.max(0, Math.min(1, meanQuality)) * 100) / 100;
}