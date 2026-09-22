import { describe, expect, it } from "vitest";
import { analyzeSmiles, calculateFaceScore, countBlinks } from "../face";

describe("face signals", () => {
  it("counts plausible blink pulses only", () => {
    const samples = [
      { t: 0, b: 0 }, { t: 1, b: 0.7 }, { t: 1.15, b: 0.7 }, { t: 1.3, b: 0 },
      { t: 2, b: 0 }, { t: 3, b: 0.7 }, { t: 3.15, b: 0 },
      { t: 4, b: 0 }, { t: 5, b: 0.7 }, { t: 5.02, b: 0 },
    ];
    expect(countBlinks(samples)).toBe(2);
  });

  it("measures a prompted smile ramp", () => {
    const samples = Array.from({ length: 30 }, (_, index) => ({ t: index / 10, v: index < 10 ? 0.1 : 0.1 + (index - 10) / 20 }));
    const result = analyzeSmiles(samples, [0]);
    expect(result.smile_amp).toBeDefined();
  });
});

describe("calculateFaceScore", () => {
  it("gives healthy expressive smile high scores (85-98)", () => {
    const score = calculateFaceScore({
      smile_amp: 0.75,
      face_expressivity: 0.08,
      blink_rate_bpm: 18,
      smile_onset_ms: 520,
    });
    expect(score).toBeGreaterThanOrEqual(85);
    expect(score).toBeLessThanOrEqual(99);
  });

  it("gives hypomimia / masked facies flat affect low scores (< 50)", () => {
    const score = calculateFaceScore({
      smile_amp: 0.08,
      face_expressivity: 0.012,
      blink_rate_bpm: 5,
      smile_onset_ms: 1800,
    });
    expect(score).toBeLessThan(45);
  });
});