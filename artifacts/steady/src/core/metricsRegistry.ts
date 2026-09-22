import type { MetricDef, MetricKey } from "./types";

export const METRICS: Record<MetricKey, MetricDef> = {
  tap_freq_hz: { key: "tap_freq_hz", task: "tapping", unit: "Hz", higherIsBetter: true, weight: 1, minScale: 0.25, decimals: 2, label: "Tap speed" },
  tap_amp_norm: { key: "tap_amp_norm", task: "tapping", unit: "", higherIsBetter: true, weight: 1, minScale: 0.05, decimals: 2, label: "Tap size" },
  tap_amp_decrement_pct: { key: "tap_amp_decrement_pct", task: "tapping", unit: "%", higherIsBetter: false, weight: 1.5, minScale: 5, decimals: 0, label: "Change in tap size" },
  tap_rhythm_cv: { key: "tap_rhythm_cv", task: "tapping", unit: "", higherIsBetter: false, weight: 1, minScale: 0.05, decimals: 2, label: "Rhythm variation" },
  tap_hesitations: { key: "tap_hesitations", task: "tapping", unit: "", higherIsBetter: false, weight: 0.5, minScale: 1, decimals: 0, label: "Hesitations" },
  blink_rate_bpm: { key: "blink_rate_bpm", task: "face", unit: "/min", higherIsBetter: true, weight: 1, minScale: 3, decimals: 0, label: "Blink rate" },
  smile_amp: { key: "smile_amp", task: "face", unit: "", higherIsBetter: true, weight: 1, minScale: 0.05, decimals: 2, label: "Smile movement" },
  smile_onset_ms: { key: "smile_onset_ms", task: "face", unit: "ms", higherIsBetter: false, weight: 0.5, minScale: 80, decimals: 0, label: "Smile start time" },
  face_expressivity: { key: "face_expressivity", task: "face", unit: "", higherIsBetter: true, weight: 1.5, minScale: 0.01, decimals: 3, label: "Facial movement" },
};