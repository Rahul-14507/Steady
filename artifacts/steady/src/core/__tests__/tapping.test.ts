import { describe, expect, it } from "vitest";
import { analyzeTapping, analyzeTouchVectors, calculateTapScore } from "../tapping";
import type { TouchVector } from "../types";

function synth(frequency: number, firstAmplitude: number, lastAmplitude: number, duration = 15, fps = 30) {
  return Array.from({ length: duration * fps }, (_, index) => {
    const time = index / fps;
    const amplitude = firstAmplitude + (lastAmplitude - firstAmplitude) * (time / duration);
    return { t: time, d: 0.5 + amplitude * Math.sin(2 * Math.PI * frequency * time) };
  });
}

function synthTouchVectors(
  tapCount: number,
  durationSec: number,
  dwellTimeMs: number,
  targetX = 200,
  targetY = 300,
  spatialNoise = 10,
  baseTimestampMs = 125430
): TouchVector[] {
  const vectors: TouchVector[] = [];
  const intervalMs = (durationSec * 1000) / tapCount;
  for (let i = 0; i < tapCount; i += 1) {
    const tDown = baseTimestampMs + i * intervalMs;
    const tUp = tDown + dwellTimeMs;
    const x = targetX + (Math.random() - 0.5) * spatialNoise;
    const y = targetY + (Math.random() - 0.5) * spatialNoise;
    vectors.push({ t: tDown, x, y, type: "down" });
    vectors.push({ t: tUp, x, y, type: "up" });
  }
  return vectors;
}

describe("analyzeTapping", () => {
  it("recovers frequency", () => {
    const metrics = analyzeTapping(synth(3, 0.3, 0.3));
    expect(metrics?.tap_freq_hz).toBeGreaterThan(2.7);
    expect(metrics?.tap_freq_hz).toBeLessThan(3.3);
  });

  it("detects amplitude decrement", () => {
    const metrics = analyzeTapping(synth(3, 0.3, 0.15));
    expect(metrics?.tap_amp_decrement_pct).toBeGreaterThan(25);
    expect(metrics?.tap_amp_decrement_pct).toBeLessThan(50);
  });

  it("rejects a barely moving hand", () => {
    expect(analyzeTapping(synth(3, 0.01, 0.01))).toBeNull();
  });
});

describe("analyzeTouchVectors", () => {
  it("accurately computes ITI variance, dwell time, and spatial drift with millisecond performance timestamps", () => {
    const vectors = synthTouchVectors(30, 10, 85, 150, 250, 12, 54000);
    const metrics = analyzeTouchVectors(vectors, 150, 250, 10);
    expect(metrics).not.toBeNull();
    expect(metrics?.tapCount).toBe(30);
    expect(metrics?.tap_freq_hz).toBeGreaterThan(2.5);
    expect(metrics?.tap_dwell_time_ms).toBeGreaterThanOrEqual(80);
    expect(metrics?.tap_dwell_time_ms).toBeLessThanOrEqual(95);
    expect(metrics?.tap_iti_variance).toBeLessThan(50);
    expect(metrics?.tap_spatial_drift_px).toBeLessThan(15);

    // Make sure a healthy tapping pattern yields an 85-98 score
    const score = calculateTapScore(metrics ?? {});
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it("detects prolonged dwell time and frequency decay in slow tapping", () => {
    // 10 taps in 10s with 350ms prolonged contact dwell time
    const vectors = synthTouchVectors(10, 10, 350, 150, 250, 40, 62000);
    const metrics = analyzeTouchVectors(vectors, 150, 250, 10);
    expect(metrics).not.toBeNull();
    expect(metrics?.tap_dwell_time_ms).toBeGreaterThanOrEqual(300);
    expect(metrics?.tap_freq_hz).toBeLessThan(1.5);

    const score = calculateTapScore(metrics ?? {});
    expect(score).toBeLessThanOrEqual(65);
  });
});

describe("calculateTapScore", () => {
  it("gives healthy rapid tappers high scores (85-98)", () => {
    const score = calculateTapScore({
      tapCount: 32,
      tap_freq_hz: 3.2,
      tap_amp_norm: 0.85,
      tap_rhythm_cv: 0.10,
      tap_iti_variance: 35,
      tap_dwell_time_ms: 80,
      tap_freq_decay: 5,
      tap_spatial_drift_px: 10,
      tap_hesitations: 0,
    });
    expect(score).toBeGreaterThanOrEqual(85);
    expect(score).toBeLessThanOrEqual(99);
  });

  it("gives healthy regular tapper (24 taps) a high normal score (85+)", () => {
    const score = calculateTapScore({
      tapCount: 24,
      tap_freq_hz: 2.4,
      tap_amp_norm: 0.80,
      tap_rhythm_cv: 0.15,
      tap_iti_variance: 55,
      tap_dwell_time_ms: 95,
      tap_freq_decay: 8,
      tap_spatial_drift_px: 15,
      tap_hesitations: 0,
    });
    expect(score).toBeGreaterThanOrEqual(85);
    expect(score).toBeLessThanOrEqual(98);
  });

  it("gives mild reduction scores (65-85)", () => {
    const score = calculateTapScore({
      tapCount: 18,
      tap_freq_hz: 1.8,
      tap_amp_norm: 0.65,
      tap_rhythm_cv: 0.24,
      tap_iti_variance: 95,
      tap_dwell_time_ms: 160,
      tap_freq_decay: 24,
      tap_spatial_drift_px: 25,
      tap_hesitations: 0,
    });
    expect(score).toBeGreaterThanOrEqual(65);
    expect(score).toBeLessThanOrEqual(85);
  });

  it("gives moderate bradykinesia scores (40-64)", () => {
    const score = calculateTapScore({
      tapCount: 13,
      tap_freq_hz: 1.3,
      tap_amp_norm: 0.40,
      tap_rhythm_cv: 0.32,
      tap_iti_variance: 150,
      tap_dwell_time_ms: 260,
      tap_freq_decay: 42,
      tap_spatial_drift_px: 45,
      tap_hesitations: 1,
    });
    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThan(65);
  });

  it("gives marked slowness & freezing low scores (< 40)", () => {
    const score = calculateTapScore({
      tapCount: 6,
      tap_freq_hz: 0.6,
      tap_amp_norm: 0.20,
      tap_rhythm_cv: 0.48,
      tap_iti_variance: 240,
      tap_dwell_time_ms: 380,
      tap_freq_decay: 65,
      tap_spatial_drift_px: 80,
      tap_hesitations: 3,
    });
    expect(score).toBeLessThan(40);
  });
});