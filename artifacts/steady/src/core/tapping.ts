import { findPeaks, mean, median, movingAverage, std } from "./signal";

export interface LM { x: number; y: number; z?: number }
export interface TapSample { t: number; d: number }

const distance = (a: LM, b: LM, width: number, height: number) =>
  Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);

export function tapSample(landmarks: LM[], width: number, height: number) {
  if (landmarks.length < 10) return null;
  const handSizePx = distance(landmarks[0], landmarks[9], width, height);
  if (!handSizePx) return null;
  return {
    d: distance(landmarks[4], landmarks[8], width, height) / handSizePx,
    handSize: handSizePx / height,
  };
}

export interface TappingMetrics {
  tap_freq_hz: number;
  tap_amp_norm: number;
  tap_amp_decrement_pct: number;
  tap_rhythm_cv: number;
  tap_hesitations: number;
  tapCount: number;
}

export function analyzeTapping(samples: TapSample[]): TappingMetrics | null {
  if (samples.length < 30) return null;
  const times = samples.map((sample) => sample.t);
  const values = movingAverage(samples.map((sample) => sample.d), 3);
  const range = Math.max(...values) - Math.min(...values);
  if (range < 0.15) return null;

  const peaks = findPeaks(values, times, range * 0.25, 0.1);
  if (peaks.length < 6) return null;

  const amplitudes: number[] = [];
  for (let peakIndex = 1; peakIndex < peaks.length; peakIndex += 1) {
    let trough = values[peaks[peakIndex]];
    for (let cursor = peaks[peakIndex - 1]; cursor <= peaks[peakIndex]; cursor += 1) trough = Math.min(trough, values[cursor]);
    amplitudes.push(values[peaks[peakIndex]] - trough);
  }

  const peakTimes = peaks.map((index) => times[index]);
  const intervals = peakTimes.slice(1).map((time, index) => time - peakTimes[index]);
  const duration = peakTimes.at(-1)! - peakTimes[0];
  const third = Math.max(2, Math.floor(amplitudes.length / 3));
  const first = mean(amplitudes.slice(0, third));
  const last = mean(amplitudes.slice(-third));
  const decrement = first > 0 ? ((first - last) / first) * 100 : 0;
  const medianInterval = median(intervals);

  return {
    tap_freq_hz: intervals.length / duration,
    tap_amp_norm: mean(amplitudes),
    tap_amp_decrement_pct: decrement,
    tap_rhythm_cv: mean(intervals) ? std(intervals) / mean(intervals) : 0,
    tap_hesitations: intervals.filter((interval) => interval > 2 * medianInterval).length,
    tapCount: peaks.length,
  };
}

export function calculateTapScore(metrics: Partial<TappingMetrics>): number {
  const tapCount = metrics.tapCount ?? 0;
  const freq = metrics.tap_freq_hz ?? (tapCount > 0 ? tapCount / 15 : 0);
  const rhythmCv = metrics.tap_rhythm_cv ?? (tapCount >= 30 ? 0.14 : tapCount >= 18 ? 0.22 : 0.35);
  const amp = metrics.tap_amp_norm ?? (tapCount >= 30 ? 0.48 : tapCount >= 18 ? 0.35 : 0.22);
  const hesitations = metrics.tap_hesitations ?? (tapCount < 18 ? 2 : 0);
  const decrement = metrics.tap_amp_decrement_pct ?? (tapCount >= 30 ? 8 : tapCount >= 18 ? 22 : 40);

  if (tapCount === 0 && freq === 0) {
    return 15; // No tapping movement detected
  }

  // 1. Speed / Frequency Component (up to 40 points)
  // Healthy normal: >= 2.5 Hz (38+ taps in 15s) -> 34-40 pts
  // Mild reduction: 1.8 - 2.5 Hz (27-37 taps) -> 25-33 pts
  // Moderate bradykinesia: 1.1 - 1.8 Hz (16-26 taps) -> 14-24 pts
  // Severe bradykinesia: < 1.1 Hz (< 16 taps) -> 4-13 pts
  let speedPts = 0;
  if (freq >= 3.2) speedPts = 40;
  else if (freq >= 2.5) speedPts = 34 + ((freq - 2.5) / 0.7) * 6;
  else if (freq >= 1.8) speedPts = 25 + ((freq - 1.8) / 0.7) * 9;
  else if (freq >= 1.1) speedPts = 14 + ((freq - 1.1) / 0.7) * 11;
  else speedPts = Math.max(4, (freq / 1.1) * 14);

  // 2. Rhythm Regularity Component (up to 30 points)
  // Healthy even rhythm: CV <= 0.20 -> 27-30 pts (accounting for webcam 30fps quantization)
  // Mild variation: CV 0.20 - 0.30 -> 20-26 pts
  // Marked irregularity / freezing gaps: CV > 0.35 -> 5-19 pts
  let rhythmPts = 0;
  if (rhythmCv <= 0.18) rhythmPts = 30;
  else if (rhythmCv <= 0.26) rhythmPts = 26 + ((0.26 - rhythmCv) / 0.08) * 4;
  else if (rhythmCv <= 0.38) rhythmPts = 16 + ((0.38 - rhythmCv) / 0.12) * 10;
  else rhythmPts = Math.max(5, 16 - (rhythmCv - 0.38) * 20);

  // 3. Tap Amplitude & Fatigue Resistance (up to 30 points)
  // Amplitude excursion (15 pts): wide opening >= 0.35 -> 15 pts
  const ampPts = Math.min(15, Math.max(3, (amp / 0.35) * 15));

  // Amplitude Decrement / Sequence Effect (15 pts)
  // Healthy: decrement < 15% -> 15 pts
  // Moderate fatigue (15-35%): 8-14 pts
  // Severe fatigue (> 35%): 2-7 pts
  let decrementPts = 15;
  if (decrement > 15) {
    decrementPts = Math.max(2, 15 - ((decrement - 15) / 35) * 13);
  }
  const ampTotal = Math.min(30, ampPts + decrementPts);

  // 4. Freezing / Hesitations Penalty (-4 points each)
  const penalty = Math.min(20, hesitations * 4);

  const rawScore = speedPts + rhythmPts + ampTotal - penalty;
  return Math.round(Math.max(15, Math.min(99, rawScore)));
}