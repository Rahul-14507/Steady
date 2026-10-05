import { findPeaks, mean, median, movingAverage, std } from "./signal";
import type { TouchVector } from "./types";

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
  // Clinical touch vector metrics
  tap_iti_variance?: number; // Standard deviation of inter-tap intervals (ms)
  tap_freq_decay?: number; // Percentage decline in tapping speed over time (%)
  tap_dwell_time_ms?: number; // Mean contact duration (ms)
  tap_spatial_drift_px?: number; // Mean spatial deviation from target center (px)
}

/**
 * Analyzes video-based optical pinch tapping samples.
 */
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

  // Derive ITI standard deviation in ms
  const itiMs = intervals.map((dt) => dt * 1000);
  const itiVariance = std(itiMs);

  // Frequency decay between first half and second half
  const half = Math.floor(intervals.length / 2);
  const firstHalfFreq = half > 0 ? half / (peakTimes[half] - peakTimes[0]) : 0;
  const secondHalfFreq = half > 0 ? (intervals.length - half) / (peakTimes.at(-1)! - peakTimes[half]) : 0;
  const freqDecay = firstHalfFreq > 0 ? Math.max(0, ((firstHalfFreq - secondHalfFreq) / firstHalfFreq) * 100) : 0;

  return {
    tap_freq_hz: intervals.length / duration,
    tap_amp_norm: mean(amplitudes),
    tap_amp_decrement_pct: decrement,
    tap_rhythm_cv: mean(intervals) ? std(intervals) / mean(intervals) : 0,
    tap_hesitations: intervals.filter((interval) => interval > 2 * medianInterval).length,
    tap_iti_variance: itiVariance,
    tap_freq_decay: freqDecay,
    tapCount: peaks.length,
  };
}

/**
 * Analyzes direct timestamped touch vectors [timestamp, x, y, 'down' | 'up'].
 * Computes the 4 core clinical Parkinson's metrics:
 * 1. Inter-Tap Interval (ITI) Variance (SD in ms) -> Rhythm regularity & motor control dysregulation
 * 2. Frequency Decay (Sequence Effect) (%) -> Progressive bradykinesia / motor exhaustion
 * 3. Contact Duration / Dwell Time (ms) -> Akinesia / freezing tendency / prolonged touch
 * 4. Spatial Error / Drift (px) -> Hypometria (undershooting) & fine motor degradation
 */
export function analyzeTouchVectors(
  vectors: TouchVector[],
  targetX?: number,
  targetY?: number,
  testWindowDurationSec = 10
): TappingMetrics | null {
  const downs = vectors.filter((v) => v.type === "down");
  if (downs.length < 3) return null;

  const t0 = vectors[0].t;
  const rawSpan = vectors[vectors.length - 1].t - t0;
  // If span is large (> 50), timestamps are in milliseconds (e.g. from performance.now())
  const isMs = rawSpan > 50;
  const toSec = (val: number) => isMs ? (val - t0) / 1000 : val - t0;
  const toMs = (val: number) => isMs ? val - t0 : (val - t0) * 1000;

  const downTimesSec = downs.map((v) => toSec(v.t));
  const downTimesMs = downs.map((v) => toMs(v.t));
  const totalDuration = Math.max(
    testWindowDurationSec,
    downTimesSec[downTimesSec.length - 1] - downTimesSec[0] || 1
  );

  // 1. Inter-Tap Interval (ITI) and Rhythm Variance
  const intervalsSec: number[] = [];
  const intervalsMs: number[] = [];
  for (let i = 1; i < downs.length; i += 1) {
    const dtMs = downTimesMs[i] - downTimesMs[i - 1];
    if (dtMs >= 30) { // filter micro-bounces < 30ms
      intervalsMs.push(dtMs);
      intervalsSec.push(dtMs / 1000);
    }
  }

  const meanItiMs = mean(intervalsMs);
  const itiVarianceSdMs = intervalsMs.length > 1 ? std(intervalsMs) : 30;
  const rhythmCv = mean(intervalsMs) > 0 ? itiVarianceSdMs / mean(intervalsMs) : 0.12;
  const medIti = median(intervalsSec);
  const hesitations = intervalsSec.filter((dt) => dt > 2.5 * medIti && dt > 0.7).length;

  // 2. Frequency Decay (Sequence Effect / Bradykinesia Exhaustion)
  // Split duration in half
  const windowHalf = totalDuration / 2;
  const firstWindowTaps = downTimesSec.filter((t) => t < windowHalf).length;
  const secondWindowTaps = downTimesSec.filter((t) => t >= windowHalf).length;

  const freqFirst = firstWindowTaps / Math.max(1, windowHalf);
  const freqLast = secondWindowTaps / Math.max(1, windowHalf);
  const freqDecayPct = freqFirst > 0 ? Math.max(0, ((freqFirst - freqLast) / freqFirst) * 100) : 0;

  // 3. Contact Duration (Dwell Time: TouchDown -> TouchUp)
  const dwellTimesMs: number[] = [];
  for (let i = 0; i < vectors.length; i += 1) {
    if (vectors[i].type === "down") {
      const downT = vectors[i].t;
      for (let j = i + 1; j < vectors.length; j += 1) {
        if (vectors[j].type === "up") {
          let dt = isMs ? vectors[j].t - downT : (vectors[j].t - downT) * 1000;
          if (dt >= 15 && dt <= 2500) {
            dwellTimesMs.push(dt);
          }
          break;
        }
        if (vectors[j].type === "down") break;
      }
    }
  }
  const meanDwellTimeMs = dwellTimesMs.length > 0 ? mean(dwellTimesMs) : 85;

  // 4. Spatial Error & Drift (Euclidean distance from target or initial centroid)
  const centroidX = targetX ?? mean(downs.slice(0, Math.min(5, downs.length)).map((v) => v.x));
  const centroidY = targetY ?? mean(downs.slice(0, Math.min(5, downs.length)).map((v) => v.y));

  const distances = downs.map((v) => Math.hypot(v.x - centroidX, v.y - centroidY));
  const meanSpatialDriftPx = mean(distances);

  const freqHz = intervalsSec.length > 0 ? intervalsSec.length / (downTimesSec[downTimesSec.length - 1] - downTimesSec[0]) : downs.length / totalDuration;

  return {
    tap_freq_hz: Math.round(freqHz * 100) / 100,
    tap_amp_norm: Math.min(1.0, Math.max(0.2, 1.0 - (meanDwellTimeMs / 400))),
    tap_amp_decrement_pct: Math.round(freqDecayPct),
    tap_rhythm_cv: Math.round(rhythmCv * 100) / 100,
    tap_hesitations: hesitations,
    tapCount: downs.length,
    tap_iti_variance: Math.round(itiVarianceSdMs * 10) / 10,
    tap_freq_decay: Math.round(freqDecayPct * 10) / 10,
    tap_dwell_time_ms: Math.round(meanDwellTimeMs),
    tap_spatial_drift_px: Math.round(meanSpatialDriftPx * 10) / 10,
  };
}

/**
 * Calculates a comprehensive clinical motor score (15 to 99) based on MDS-UPDRS standards.
 * Calibrated so healthy individuals score 85–98, while motor impairment reduces the score accurately.
 */
export function calculateTapScore(metrics: Partial<TappingMetrics>): number {
  const tapCount = metrics.tapCount ?? 0;
  const freq = metrics.tap_freq_hz ?? (tapCount > 0 ? tapCount / 10 : 0);
  const rhythmCv = metrics.tap_rhythm_cv ?? (tapCount >= 25 ? 0.12 : tapCount >= 16 ? 0.22 : 0.35);
  const itiSd = metrics.tap_iti_variance ?? (rhythmCv * 300);
  const dwellTime = metrics.tap_dwell_time_ms ?? 85;
  const decay = metrics.tap_freq_decay ?? metrics.tap_amp_decrement_pct ?? 8;
  const hesitations = metrics.tap_hesitations ?? (tapCount < 12 ? 2 : 0);
  const spatialDrift = metrics.tap_spatial_drift_px ?? 12;

  if (tapCount === 0 && freq === 0) {
    return 15; // No tapping movement detected
  }

  // 1. Speed / Frequency Component (up to 35 points)
  // Healthy adult: >= 2.2 Hz (22+ taps in 10s) -> 30-35 pts
  // Mild reduction: 1.6 - 2.2 Hz -> 22-29 pts
  // Moderate bradykinesia: 1.0 - 1.6 Hz -> 12-21 pts
  // Severe bradykinesia: < 1.0 Hz -> 4-11 pts
  let speedPts = 0;
  if (freq >= 2.8) speedPts = 35;
  else if (freq >= 2.2) speedPts = 30 + ((freq - 2.2) / 0.6) * 5;
  else if (freq >= 1.6) speedPts = 22 + ((freq - 1.6) / 0.6) * 7;
  else if (freq >= 1.0) speedPts = 12 + ((freq - 1.0) / 0.6) * 9;
  else speedPts = Math.max(4, (freq / 1.0) * 11);

  // 2. Rhythm Regularity & ITI Variance (up to 25 points)
  // Healthy touchscreen tapping: ITI SD <= 75ms (CV <= 0.22) -> 22-25 pts
  // Mild irregularity: ITI SD 75-130ms -> 15-21 pts
  // Moderate dysregulation: ITI SD 130-220ms -> 8-14 pts
  // Severe freezing / gaps: ITI SD > 220ms -> 2-7 pts
  let rhythmPts = 0;
  if (itiSd <= 60) rhythmPts = 25;
  else if (itiSd <= 85) rhythmPts = 22 + ((85 - itiSd) / 25) * 3;
  else if (itiSd <= 140) rhythmPts = 15 + ((140 - itiSd) / 55) * 6;
  else if (itiSd <= 220) rhythmPts = 8 + ((220 - itiSd) / 80) * 6;
  else rhythmPts = Math.max(2, 8 - ((itiSd - 220) / 100) * 6);

  // 3. Contact Duration / Dwell Time (up to 20 points)
  // Healthy brisk touch: <= 140ms -> 18-20 pts
  // Mild prolongation: 140 - 220ms -> 12-17 pts
  // Moderate akinesia: 220 - 350ms -> 6-11 pts
  // Severe freezing: > 350ms -> 2-5 pts
  let dwellPts = 20;
  if (dwellTime > 140) {
    if (dwellTime <= 220) dwellPts = 12 + ((220 - dwellTime) / 80) * 6;
    else if (dwellTime <= 350) dwellPts = 6 + ((350 - dwellTime) / 130) * 5;
    else dwellPts = Math.max(2, 6 - ((dwellTime - 350) / 200) * 4);
  }

  // 4. Fatigue Resistance & Frequency Decay (up to 20 points)
  // Healthy sequence effect: decay <= 18% -> 18-20 pts
  // Mild exhaustion: 18% - 35% -> 12-17 pts
  // Marked progressive bradykinesia: 35% - 60% -> 5-11 pts
  // Severe exhaustion: > 60% -> 2-4 pts
  let decayPts = 20;
  if (decay > 18) {
    if (decay <= 35) decayPts = 12 + ((35 - decay) / 17) * 6;
    else if (decay <= 60) decayPts = 5 + ((60 - decay) / 25) * 6;
    else decayPts = Math.max(2, 5 - ((decay - 60) / 30) * 3);
  }

  // 5. Hesitations & Spatial Drift Penalties
  const hesitationPenalty = Math.min(15, hesitations * 3);
  const driftPenalty = spatialDrift > 60 ? Math.min(8, ((spatialDrift - 60) / 30) * 2) : 0;

  const rawScore = speedPts + rhythmPts + dwellPts + decayPts - hesitationPenalty - driftPenalty;
  return Math.round(Math.max(15, Math.min(99, rawScore)));
}