import { saveSession } from "./db";
import type { MedState, MetricKey, Session } from "../core/types";

const metricSeeds: Record<MetricKey, number> = {
  tap_freq_hz: 3.2,
  tap_amp_norm: 0.42,
  tap_amp_decrement_pct: 13,
  tap_rhythm_cv: 0.09,
  tap_hesitations: 1,
  blink_rate_bpm: 14,
  smile_amp: 0.48,
  smile_onset_ms: 640,
  face_expressivity: 0.08,
};

export async function seedDemoData(now = Date.now()) {
  const sessions: Session[] = [];
  for (let day = 60; day >= 0; day -= 3) {
    const startedAt = now - day * 86_400_000;
    const medState: MedState = day % 2 ? "on" : "off";
    const task = day % 3 === 0 ? "face" : "tapping";
    const drift = (60 - day) * 0.001;
    const metrics: Partial<Record<MetricKey, number>> = {};
    const keys = task === "face"
      ? (["blink_rate_bpm", "smile_amp", "smile_onset_ms", "face_expressivity"] as MetricKey[])
      : (["tap_freq_hz", "tap_amp_norm", "tap_amp_decrement_pct", "tap_rhythm_cv", "tap_hesitations"] as MetricKey[]);
    keys.forEach((key, index) => {
      const variation = Math.sin(day * 0.7 + index) * 0.04;
      metrics[key] = Math.max(0, metricSeeds[key] * (1 + variation + drift));
    });
    sessions.push({
      id: `demo-${day}`,
      task,
      startedAt,
      durationSec: task === "face" ? 42 : 15,
      hand: task === "tapping" ? (day % 2 ? "right" : "left") : undefined,
      medState,
      metrics,
      quality: { score: 88 + (day % 8), validFrameRatio: 0.9, issues: [] },
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