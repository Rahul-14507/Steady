import { describe, expect, it } from "vitest";
import { computeBaseline, trendLabel, trendScore, zScore } from "../baseline";

describe("personal baselines", () => {
  it("waits for three sessions and uses a robust spread", () => {
    expect(computeBaseline("tap_freq_hz", [3, 3.1])).toBeNull();
    const baseline = computeBaseline("tap_freq_hz", [3, 3.1, 3.2]);
    expect(baseline?.median).toBe(3.1);
    expect(baseline?.scale).toBeGreaterThanOrEqual(0.25);
  });

  it("adjusts direction and clamps trend scores", () => {
    const baseline = computeBaseline("tap_freq_hz", [3, 3.1, 3.2])!;
    expect(zScore("tap_freq_hz", 3.2, baseline)).toBeGreaterThan(0);
    const score = trendScore({ tap_freq_hz: 3.2 }, { tap_freq_hz: baseline });
    expect(score?.score).toBeGreaterThanOrEqual(50);
    expect(trendLabel(score?.score ?? 50)).toBe("similar");
  });
});