import { mean, std } from "./signal";
import type { TremorSample } from "./types";

export interface TremorMetrics {
  tremor_freq_hz: number; // Dominant peak frequency in Hz
  tremor_power_4_6hz: number; // Percentage of total power concentrated in 4-6 Hz band (%)
  tremor_amplitude_rms: number; // RMS acceleration amplitude in m/s^2
  tremor_constancy_pct: number; // Percentage of time 4-6 Hz tremor is sustained (%)
  peak_power: number; // Absolute power of the dominant peak
}

export interface PSDResult {
  frequencies: number[];
  powers: number[];
  peakFreq: number;
  peakPower: number;
  power4to6Ratio: number;
}

/**
 * Computes Discrete Fourier Transform / Power Spectral Density with Hann windowing for a 1D signal.
 */
export function compute1DPSD(signal: number[], sampleRate: number): { frequencies: number[]; powers: number[] } {
  const n = signal.length;
  if (n < 8) {
    return { frequencies: [], powers: [] };
  }

  // Apply Hann window
  const windowed: number[] = new Array(n);
  let windowSumSq = 0;
  for (let i = 0; i < n; i += 1) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    windowed[i] = signal[i] * w;
    windowSumSq += w * w;
  }
  if (windowSumSq === 0) windowSumSq = 1;

  const maxFreq = Math.min(15, sampleRate / 2);
  const freqStep = 0.1; // 0.1 Hz resolution
  const numSteps = Math.floor((maxFreq - 0.5) / freqStep);

  const frequencies: number[] = [];
  const powers: number[] = [];

  for (let step = 0; step <= numSteps; step += 1) {
    const f = 0.5 + step * freqStep;
    let real = 0;
    let imag = 0;
    const omega = (2 * Math.PI * f) / sampleRate;

    for (let t = 0; t < n; t += 1) {
      const angle = omega * t;
      real += windowed[t] * Math.cos(angle);
      imag -= windowed[t] * Math.sin(angle);
    }

    const power = (real * real + imag * imag) / windowSumSq;
    frequencies.push(f);
    powers.push(power);
  }

  return { frequencies, powers };
}

/**
 * Computes combined 3-axis (X, Y, Z) Power Spectral Density.
 * Combining orthogonal linear axes preserves true frequency content without
 * harmonic frequency-doubling artifacts.
 */
export function computePSD(samples: { ax: number; ay: number; az: number }[], sampleRate: number): PSDResult {
  if (samples.length < 8) {
    return { frequencies: [], powers: [], peakFreq: 0, peakPower: 0, power4to6Ratio: 0 };
  }

  const axMean = mean(samples.map((s) => s.ax));
  const ayMean = mean(samples.map((s) => s.ay));
  const azMean = mean(samples.map((s) => s.az));

  const xDetrended = samples.map((s) => s.ax - axMean);
  const yDetrended = samples.map((s) => s.ay - ayMean);
  const zDetrended = samples.map((s) => s.az - azMean);

  const psdX = compute1DPSD(xDetrended, sampleRate);
  const psdY = compute1DPSD(yDetrended, sampleRate);
  const psdZ = compute1DPSD(zDetrended, sampleRate);

  const frequencies = psdX.frequencies;
  const powers: number[] = [];

  let totalTremorPower = 0;
  let pdBandPower = 0; // 4.0 to 6.0 Hz
  let maxP = 0;
  let dominantFreq = 0;

  for (let i = 0; i < frequencies.length; i += 1) {
    const f = frequencies[i];
    const combinedP = (psdX.powers[i] || 0) + (psdY.powers[i] || 0) + (psdZ.powers[i] || 0);
    powers.push(combinedP);

    if (f >= 1.0 && f <= 12.0) {
      totalTremorPower += combinedP;
    }
    if (f >= 4.0 && f <= 6.0) {
      pdBandPower += combinedP;
    }

    if (f >= 1.0 && f <= 12.0 && combinedP > maxP) {
      maxP = combinedP;
      dominantFreq = f;
    }
  }

  const ratio = totalTremorPower > 0 ? (pdBandPower / totalTremorPower) * 100 : 0;

  return {
    frequencies,
    powers,
    peakFreq: dominantFreq,
    peakPower: maxP,
    power4to6Ratio: Math.min(100, Math.max(0, ratio)),
  };
}

/**
 * Analyzes a 10-second rest tremor recording.
 * Isolates acceleration vibrations across orthogonal axes, removes DC gravity,
 * and performs 3-axis spectral analysis for 4–6 Hz Parkinsonian rest tremor peak.
 */
export function analyzeTremorSignal(samples: TremorSample[]): TremorMetrics | null {
  if (samples.length < 50) return null;

  const t0 = samples[0].t;
  const duration = samples[samples.length - 1].t - t0;
  if (duration < 2.0) return null;

  const sampleRate = (samples.length - 1) / duration;

  // Compute 3-axis dynamic variation and RMS amplitude
  const axMean = mean(samples.map((s) => s.ax));
  const ayMean = mean(samples.map((s) => s.ay));
  const azMean = mean(samples.map((s) => s.az));

  const totalVar = mean(samples.map((s) => (s.ax - axMean) ** 2 + (s.ay - ayMean) ** 2 + (s.az - azMean) ** 2));
  const rms = Math.sqrt(totalVar);

  // PSD analysis across full signal
  const psd = computePSD(samples, sampleRate);

  // Constancy analysis: Divide into 1-second epochs
  const epochDurationSec = 1.0;
  const numEpochs = Math.max(1, Math.floor(duration / epochDurationSec));
  let pdActiveEpochs = 0;

  for (let e = 0; e < numEpochs; e += 1) {
    const epochStartT = t0 + e * epochDurationSec;
    const epochEndT = epochStartT + epochDurationSec;
    const epochSamples = samples.filter((s) => s.t >= epochStartT && s.t < epochEndT);
    if (epochSamples.length >= 10) {
      const eAxMean = mean(epochSamples.map((s) => s.ax));
      const eAyMean = mean(epochSamples.map((s) => s.ay));
      const eAzMean = mean(epochSamples.map((s) => s.az));
      const eVar = mean(epochSamples.map((s) => (s.ax - eAxMean) ** 2 + (s.ay - eAyMean) ** 2 + (s.az - eAzMean) ** 2));
      const epochRms = Math.sqrt(eVar);
      const epochRate = (epochSamples.length - 1) / epochDurationSec;
      const epochPsd = computePSD(epochSamples, epochRate);

      // Check if 4-6 Hz is prominent and has meaningful amplitude (> 0.08 m/s^2)
      if (epochPsd.peakFreq >= 3.8 && epochPsd.peakFreq <= 6.2 && epochPsd.power4to6Ratio > 40 && epochRms > 0.08) {
        pdActiveEpochs += 1;
      }
    }
  }

  const constancyPct = (pdActiveEpochs / numEpochs) * 100;

  return {
    tremor_freq_hz: Math.round(psd.peakFreq * 100) / 100,
    tremor_power_4_6hz: Math.round(psd.power4to6Ratio * 10) / 10,
    tremor_amplitude_rms: Math.round(rms * 1000) / 1000,
    tremor_constancy_pct: Math.round(constancyPct),
    peak_power: Math.round(psd.peakPower * 1000) / 1000,
  };
}

/**
 * Calculates a Steady clinical motor score (15 to 99) for Rest Tremor.
 * Higher score = Normal / Steady (absence of 4-6 Hz tremor, 90-98 pts).
 * Lower score = Clinically significant rest tremor (MDS-UPDRS Item 3.17 / 3.18).
 */
export function calculateTremorScore(metrics: Partial<TremorMetrics>): number {
  const peakFreq = metrics.tremor_freq_hz ?? 0;
  const power4to6 = metrics.tremor_power_4_6hz ?? 0;
  const rms = metrics.tremor_amplitude_rms ?? 0.02;
  const constancy = metrics.tremor_constancy_pct ?? 0;

  // Check if tremor is primarily in the 4-6 Hz Parkinsonian band
  const isPdBand = peakFreq >= 3.8 && peakFreq <= 6.2;
  const pdConcentration = isPdBand ? Math.min(1.0, power4to6 / 75) : Math.min(0.2, power4to6 / 100);

  // If there is negligible 4-6 Hz tremor power (< 25%) or no 4-6 Hz peak, user is clinically steady:
  if (power4to6 < 25 || !isPdBand) {
    // Normal hand sway / stationary rest yields 90-98 pts
    const baselinePenalty = Math.min(6, rms * 8);
    return Math.round(Math.max(90, 97 - baselinePenalty));
  }

  // Active 4-6 Hz Parkinsonian oscillation:
  // Combines 4-6 Hz power concentration, RMS amplitude, and constancy
  let score = 96;

  // 1. Power penalty in 4-6 Hz (up to 25 pts)
  const powerPenalty = (power4to6 / 100) * 25;

  // 2. Amplitude penalty (up to 32 pts)
  let ampPenalty = 0;
  if (rms <= 0.10) ampPenalty = (rms / 0.10) * 8;
  else if (rms <= 0.40) ampPenalty = 8 + ((rms - 0.10) / 0.30) * 14;
  else ampPenalty = Math.min(32, 22 + ((rms - 0.40) / 0.60) * 10);

  // 3. Constancy penalty (up to 20 pts)
  const constancyPenalty = (constancy / 100) * 20;

  const totalDeduction = (powerPenalty + ampPenalty + constancyPenalty) * (0.5 + 0.5 * pdConcentration);
  score = score - totalDeduction;

  return Math.round(Math.max(15, Math.min(99, score)));
}
