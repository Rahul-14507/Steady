import { describe, expect, it } from "vitest";
import { analyzeTremorSignal, calculateTremorScore, computePSD } from "../tremor";
import type { TremorSample } from "../types";

function synthTremorSignal(
  dominantFreqHz: number,
  amplitude: number,
  durationSec = 10,
  sampleRate = 50,
  noiseAmp = 0.02
): TremorSample[] {
  const totalSamples = Math.floor(durationSec * sampleRate);
  const samples: TremorSample[] = [];

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    const oscillation = amplitude * Math.sin(2 * Math.PI * dominantFreqHz * t);
    const noise = (Math.random() - 0.5) * 2 * noiseAmp;
    // Base gravity on Z axis ~ 9.8 m/s^2, tremor primarily on X/Y axis
    samples.push({
      t,
      ax: oscillation + noise,
      ay: (oscillation * 0.7) + noise,
      az: 9.81 + noise,
    });
  }
  return samples;
}

describe("computePSD & analyzeTremorSignal", () => {
  it("detects 5 Hz Parkinsonian rest tremor peak accurately", () => {
    // 5.0 Hz oscillation with 0.4 m/s^2 amplitude
    const samples = synthTremorSignal(5.0, 0.4, 10, 50, 0.01);
    const metrics = analyzeTremorSignal(samples);
    expect(metrics).not.toBeNull();
    expect(metrics?.tremor_freq_hz).toBeGreaterThanOrEqual(4.7);
    expect(metrics?.tremor_freq_hz).toBeLessThanOrEqual(5.3);
    expect(metrics?.tremor_power_4_6hz).toBeGreaterThan(60);
    expect(metrics?.tremor_amplitude_rms).toBeGreaterThan(0.15);
  });

  it("differentiates 9 Hz essential/physiological tremor from 4-6 Hz Parkinsonian band", () => {
    // 9.0 Hz oscillation
    const samples = synthTremorSignal(9.0, 0.3, 10, 50, 0.01);
    const metrics = analyzeTremorSignal(samples);
    expect(metrics).not.toBeNull();
    expect(metrics?.tremor_freq_hz).toBeGreaterThan(8.0);
    // 4-6 Hz band power should be low
    expect(metrics?.tremor_power_4_6hz).toBeLessThan(20);
  });

  it("handles quiet stationary rest with high steady score", () => {
    // stationary: only minimal noise
    const samples = synthTremorSignal(0, 0, 10, 50, 0.01);
    const metrics = analyzeTremorSignal(samples);
    expect(metrics).not.toBeNull();
    expect(metrics?.tremor_amplitude_rms).toBeLessThan(0.05);

    const score = calculateTremorScore(metrics ?? {});
    expect(score).toBeGreaterThanOrEqual(90);
  });
});

describe("calculateTremorScore", () => {
  it("gives high steady score (90-99) for stationary quiet hold", () => {
    const score = calculateTremorScore({
      tremor_freq_hz: 0,
      tremor_power_4_6hz: 5,
      tremor_amplitude_rms: 0.02,
      tremor_constancy_pct: 0,
    });
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("gives mild tremor score (50-70) for moderate 5 Hz rest tremor", () => {
    const score = calculateTremorScore({
      tremor_freq_hz: 5.0,
      tremor_power_4_6hz: 75,
      tremor_amplitude_rms: 0.25,
      tremor_constancy_pct: 50,
    });
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThanOrEqual(70);
  });

  it("gives marked rest tremor low score (< 40) for severe persistent 5 Hz tremor", () => {
    const score = calculateTremorScore({
      tremor_freq_hz: 4.8,
      tremor_power_4_6hz: 90,
      tremor_amplitude_rms: 0.85,
      tremor_constancy_pct: 90,
    });
    expect(score).toBeLessThan(40);
  });
});
