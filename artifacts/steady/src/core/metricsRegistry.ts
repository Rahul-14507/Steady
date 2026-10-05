import type { MetricDef, MetricKey } from "./types";

export const METRICS: Record<MetricKey, MetricDef> = {
  tap_freq_hz: { key: "tap_freq_hz", task: "tapping", unit: "Hz", higherIsBetter: true, weight: 1, minScale: 0.25, decimals: 2, label: "Tap speed" },
  tap_amp_norm: { key: "tap_amp_norm", task: "tapping", unit: "", higherIsBetter: true, weight: 1, minScale: 0.05, decimals: 2, label: "Tap size" },
  tap_amp_decrement_pct: { key: "tap_amp_decrement_pct", task: "tapping", unit: "%", higherIsBetter: false, weight: 1.5, minScale: 5, decimals: 0, label: "Change in tap size" },
  tap_rhythm_cv: { key: "tap_rhythm_cv", task: "tapping", unit: "", higherIsBetter: false, weight: 1, minScale: 0.05, decimals: 2, label: "Rhythm variation" },
  tap_hesitations: { key: "tap_hesitations", task: "tapping", unit: "", higherIsBetter: false, weight: 0.5, minScale: 1, decimals: 0, label: "Hesitations" },

  // Clinical touch vector metrics
  tap_iti_variance: { key: "tap_iti_variance", task: "tapping", unit: "ms", higherIsBetter: false, weight: 1.5, minScale: 10, decimals: 1, label: "ITI rhythm variance (SD)" },
  tap_freq_decay: { key: "tap_freq_decay", task: "tapping", unit: "%", higherIsBetter: false, weight: 1.5, minScale: 5, decimals: 1, label: "Frequency decay (sequence effect)" },
  tap_dwell_time_ms: { key: "tap_dwell_time_ms", task: "tapping", unit: "ms", higherIsBetter: false, weight: 1.2, minScale: 15, decimals: 0, label: "Contact duration (dwell time)" },
  tap_spatial_drift_px: { key: "tap_spatial_drift_px", task: "tapping", unit: "px", higherIsBetter: false, weight: 1.0, minScale: 5, decimals: 1, label: "Spatial error & drift" },

  // Face metrics
  blink_rate_bpm: { key: "blink_rate_bpm", task: "face", unit: "/min", higherIsBetter: true, weight: 1, minScale: 3, decimals: 0, label: "Blink rate" },
  smile_amp: { key: "smile_amp", task: "face", unit: "", higherIsBetter: true, weight: 1, minScale: 0.05, decimals: 2, label: "Smile movement" },
  smile_onset_ms: { key: "smile_onset_ms", task: "face", unit: "ms", higherIsBetter: false, weight: 0.5, minScale: 80, decimals: 0, label: "Smile start time" },
  face_expressivity: { key: "face_expressivity", task: "face", unit: "", higherIsBetter: true, weight: 1.5, minScale: 0.01, decimals: 3, label: "Facial movement" },

  // Rest Tremor 4-6 Hz metrics
  tremor_freq_hz: { key: "tremor_freq_hz", task: "tremor", unit: "Hz", higherIsBetter: false, weight: 1.0, minScale: 0.2, decimals: 2, label: "Peak tremor frequency" },
  tremor_power_4_6hz: { key: "tremor_power_4_6hz", task: "tremor", unit: "%", higherIsBetter: false, weight: 2.0, minScale: 5, decimals: 1, label: "4–6 Hz tremor power ratio" },
  tremor_amplitude_rms: { key: "tremor_amplitude_rms", task: "tremor", unit: "m/s²", higherIsBetter: false, weight: 1.5, minScale: 0.02, decimals: 3, label: "Tremor RMS amplitude" },
  tremor_constancy_pct: { key: "tremor_constancy_pct", task: "tremor", unit: "%", higherIsBetter: false, weight: 1.2, minScale: 10, decimals: 0, label: "Tremor constancy" },
};