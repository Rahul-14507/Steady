import { saveSession } from "./db";
import type { MedState, MetricKey, Session } from "../core/types";

const metricSeeds: Record<MetricKey, number> = {
  tap_freq_hz: 3.2,
  tap_amp_norm: 0.42,
  tap_amp_decrement_pct: 13,
  tap_rhythm_cv: 0.09,
  tap_hesitations: 0,
  // Clinical touch vector metrics
  tap_iti_variance: 28.5,
  tap_freq_decay: 8.2,
  tap_dwell_time_ms: 85,
  tap_spatial_drift_px: 12.4,
  // Face metrics
  blink_rate_bpm: 14,
  smile_amp: 0.48,
  smile_onset_ms: 640,
  face_expressivity: 0.08,
  // Tremor metrics
  tremor_freq_hz: 4.9,
  tremor_power_4_6hz: 8.5,
  tremor_amplitude_rms: 0.032,
  tremor_constancy_pct: 5,
};

export async function seedDemoData(now = Date.now()) {
  const sessions: Session[] = [];
  for (let day = 60; day >= 0; day -= 3) {
    const startedAt = now - day * 86_400_000;
    const medState: MedState = day % 2 ? "on" : "off";
    const task = day % 3 === 0 ? "face" : day % 3 === 1 ? "tapping" : "tremor";
    const drift = (60 - day) * 0.001;
    const metrics: Partial<Record<MetricKey, number>> = {};
    
    let keys: MetricKey[] = [];
    if (task === "face") {
      keys = ["blink_rate_bpm", "smile_amp", "smile_onset_ms", "face_expressivity"];
    } else if (task === "tapping") {
      keys = ["tap_freq_hz", "tap_amp_norm", "tap_amp_decrement_pct", "tap_rhythm_cv", "tap_hesitations", "tap_iti_variance", "tap_freq_decay", "tap_dwell_time_ms", "tap_spatial_drift_px"];
    } else {
      keys = ["tremor_freq_hz", "tremor_power_4_6hz", "tremor_amplitude_rms", "tremor_constancy_pct"];
    }

    keys.forEach((key, index) => {
      const variation = Math.sin(day * 0.7 + index) * 0.04;
      metrics[key] = Math.max(0, metricSeeds[key] * (1 + variation + drift));
    });

    sessions.push({
      id: `demo-${day}`,
      task,
      startedAt,
      durationSec: task === "face" ? 8 : 10,
      hand: task === "tapping" ? (day % 2 ? "right" : "left") : task === "tremor" ? "right" : undefined,
      medState,
      metrics,
      quality: { score: 88 + (day % 8), validFrameRatio: 0.95, issues: [] },
      valid: true,
      isDemo: true,
    });
  }
  await Promise.all(sessions.map(saveSession));
  return sessions.length;
}

export async function removeDemoData(db: { sessions: { where: (key: string) => { equals: (value: number) => { delete: () => Promise<void> } } } }) {
  await db.sessions.where("isDemo").equals(1).delete();
}