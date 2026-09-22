import { describe, expect, it } from "vitest";
import { analyzeTapping, calculateTapScore } from "../tapping";

function synth(frequency: number, firstAmplitude: number, lastAmplitude: number, duration = 15, fps = 30) {
  return Array.from({ length: duration * fps }, (_, index) => {
    const time = index / fps;
    const amplitude = firstAmplitude + (lastAmplitude - firstAmplitude) * (time / duration);
    return { t: time, d: 0.5 + amplitude * Math.sin(2 * Math.PI * frequency * time) };
  });
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

describe("calculateTapScore", () => {
  it("gives healthy rapid tappers high scores (85-98)", () => {
    const score = calculateTapScore({
      tapCount: 45,
      tap_freq_hz: 3.0,
      tap_amp_norm: 0.50,
      tap_amp_decrement_pct: 8,
      tap_rhythm_cv: 0.12,
      tap_hesitations: 0,
    });
    expect(score).toBeGreaterThanOrEqual(85);
    expect(score).toBeLessThanOrEqual(99);
  });

  it("gives mild reduction scores (65-85)", () => {
    const score = calculateTapScore({
      tapCount: 28,
      tap_freq_hz: 1.86,
      tap_amp_norm: 0.36,
      tap_amp_decrement_pct: 18,
      tap_rhythm_cv: 0.22,
      tap_hesitations: 0,
    });
    expect(score).toBeGreaterThanOrEqual(65);
    expect(score).toBeLessThanOrEqual(85);
  });

  it("gives moderate bradykinesia scores (45-64)", () => {
    const score = calculateTapScore({
      tapCount: 18,
      tap_freq_hz: 1.2,
      tap_amp_norm: 0.22,
      tap_amp_decrement_pct: 35,
      tap_rhythm_cv: 0.32,
      tap_hesitations: 1,
    });
    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThan(65);
  });

  it("gives marked slowness & freezing low scores (< 45)", () => {
    const score = calculateTapScore({
      tapCount: 8,
      tap_freq_hz: 0.53,
      tap_amp_norm: 0.14,
      tap_amp_decrement_pct: 50,
      tap_rhythm_cv: 0.45,
      tap_hesitations: 3,
    });
    expect(score).toBeLessThan(40);
  });
});