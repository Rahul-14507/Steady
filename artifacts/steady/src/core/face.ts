import { mean, median, std } from "./signal";

export interface FaceSignal { t: number; b: number }

export function countBlinks(samples: FaceSignal[], closeThreshold = 0.5, openThreshold = 0.3) {
  let closed = false;
  let startedAt = 0;
  let previousTime = -Infinity;
  let count = 0;
  for (const sample of samples) {
    if (sample.t - previousTime > 0.25) closed = false;
    if (!closed && sample.b > closeThreshold) {
      closed = true;
      startedAt = sample.t;
    } else if (closed && sample.b < openThreshold) {
      closed = false;
      const durationMs = (sample.t - startedAt) * 1000;
      if (durationMs >= 60 && durationMs <= 800) count += 1;
    }
    previousTime = sample.t;
  }
  return count;
}

export function observedSeconds(times: number[]) {
  let total = 0;
  for (let index = 1; index < times.length; index += 1) {
    const delta = times[index] - times[index - 1];
    if (delta <= 0.25) total += delta;
  }
  return total;
}

export function blinkRatePerMin(samples: FaceSignal[]) {
  const observed = observedSeconds(samples.map((sample) => sample.t));
  return observed < 20 ? undefined : countBlinks(samples) / (observed / 60);
}

export function analyzeSmiles(samples: { t: number; v: number }[], cues: number[], windowSec = 4) {
  const amplitudes: number[] = [];
  const onsets: number[] = [];
  for (const cue of cues) {
    const baselineSamples = samples.filter((sample) => sample.t >= cue - 0.5 && sample.t < cue).map((sample) => sample.v);
    const baseline = baselineSamples.length ? median(baselineSamples) : 0;
    const window = samples.filter((sample) => sample.t >= cue && sample.t <= cue + windowSec);
    if (window.length < 10) continue;
    const peak = Math.max(...window.map((sample) => sample.v)) - baseline;
    amplitudes.push(peak);
    const hit = window.find((sample) => sample.v - baseline >= 0.5 * peak);
    if (hit && peak > 0.05) onsets.push((hit.t - cue) * 1000);
  }
  return {
    smile_amp: amplitudes.length ? median(amplitudes) : undefined,
    smile_onset_ms: onsets.length ? median(onsets) : undefined,
  };
}

export const EXPR_KEYS = [
  "browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
  "cheekSquintLeft", "cheekSquintRight", "mouthSmileLeft", "mouthSmileRight",
  "mouthFrownLeft", "mouthFrownRight", "mouthPucker", "jawOpen", "noseSneerLeft", "noseSneerRight",
] as const;

export function expressivity(frames: Record<string, number>[]) {
  if (frames.length < 60) return undefined;
  return mean(EXPR_KEYS.map((key) => std(frames.map((frame) => frame[key] ?? 0))));
}

export function blendMap(result: { faceBlendshapes?: Array<{ categories?: Array<{ categoryName: string; score: number }> }> }) {
  const categories = result.faceBlendshapes?.[0]?.categories;
  if (!categories) return null;
  return Object.fromEntries(categories.map((category) => [category.categoryName, category.score]));
}

export interface FaceMetrics {
  blink_rate_bpm?: number;
  smile_amp?: number;
  smile_onset_ms?: number;
  face_expressivity?: number;
}

export function calculateFaceScore(metrics: FaceMetrics): number {
  const smileAmp = metrics.smile_amp ?? 0;
  const expr = metrics.face_expressivity ?? 0.02;
  const blinkRate = metrics.blink_rate_bpm ?? 14;
  const smileOnset = metrics.smile_onset_ms ?? 1200;

  // 1. Smile Amplitude & Range (up to 40 points)
  // Healthy full smile: >= 0.45 (45%+ lip excursion) -> 35-40 pts
  // Moderate smile: 0.25 - 0.45 -> 22-34 pts
  // Reduced smile (Hypomimia / flat affect): 0.10 - 0.25 -> 10-21 pts
  // Minimal / No smile (< 0.10): -> 2-9 pts
  let smilePts = 0;
  if (smileAmp >= 0.45) smilePts = 40;
  else if (smileAmp >= 0.25) smilePts = 22 + ((smileAmp - 0.25) / 0.20) * 18;
  else if (smileAmp >= 0.10) smilePts = 10 + ((smileAmp - 0.10) / 0.15) * 12;
  else smilePts = Math.max(2, (smileAmp / 0.10) * 9);

  // 2. Facial Expressivity / Micro-movement std (up to 30 points)
  // Healthy expressive face: std >= 0.05 -> 26-30 pts
  // Mild reduction: std 0.025 - 0.05 -> 15-25 pts
  // Masked facies (stiff / flat face): std < 0.025 -> 4-14 pts
  let exprPts = 0;
  if (expr >= 0.05) exprPts = 30;
  else if (expr >= 0.025) exprPts = 15 + ((expr - 0.025) / 0.025) * 15;
  else exprPts = Math.max(4, (expr / 0.025) * 14);

  // 3. Spontaneous Blinking Rate (up to 15 points)
  // Normal spontaneous rate: 10-24 bpm -> 13-15 pts
  // Reduced blink rate (< 8 bpm, typical in Parkinson's staring): -> 4-9 pts
  let blinkPts = 0;
  if (blinkRate >= 10 && blinkRate <= 24) blinkPts = 15;
  else if (blinkRate >= 6) blinkPts = 9 + ((blinkRate - 6) / 4) * 4;
  else if (blinkRate > 0) blinkPts = 5;
  else blinkPts = 8;

  // 4. Smile Responsiveness / Onset Speed (up to 15 points)
  // Fast natural response (< 650ms): 15 pts
  // Normal response (650 - 1000ms): 10-14 pts
  // Delayed onset (> 1300ms or no smile): 3-7 pts
  let onsetPts = 0;
  if (smileAmp < 0.10) {
    onsetPts = 3; // No genuine smile response observed
  } else if (smileOnset <= 650) {
    onsetPts = 15;
  } else if (smileOnset <= 1000) {
    onsetPts = 10 + ((1000 - smileOnset) / 350) * 5;
  } else if (smileOnset <= 1500) {
    onsetPts = 5 + ((1500 - smileOnset) / 500) * 5;
  } else {
    onsetPts = 4;
  }

  const rawScore = smilePts + exprPts + blinkPts + onsetPts;
  return Math.round(Math.max(15, Math.min(99, rawScore)));
}