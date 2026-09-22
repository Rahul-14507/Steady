import { METRICS } from "./metricsRegistry";
import type { MetricKey } from "./types";

export function explainChange(key: MetricKey, current: number, baseline: { median: number }) {
  const pctChange = baseline.median ? Math.round(((current - baseline.median) / Math.abs(baseline.median)) * 100) : 0;
  const absolute = Math.abs(pctChange);
  const direction = absolute < 10 ? "same" : pctChange > 0 ? "higher" : "lower";
  return {
    key,
    label: METRICS[key].label,
    current,
    baseline: baseline.median,
    pctChange,
    direction,
    unit: METRICS[key].unit,
  };
}