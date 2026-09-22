import { describe, expect, it } from "vitest";
import { findPeaks, median, movingAverage } from "../signal";

describe("signal helpers", () => {
  it("computes a median and smooths edge values", () => {
    expect(median([4, 1, 3])).toBe(3);
    expect(movingAverage([0, 2, 4], 3)).toEqual([1, 2, 3]);
  });

  it("finds spaced peaks and keeps the taller close peak", () => {
    const values = [0, 1, 0, 0, 0.8, 0, 0, 1.2, 0];
    expect(findPeaks(values, values.map((_, index) => index), 0.4, 2)).toEqual([1, 4, 7]);
  });
});