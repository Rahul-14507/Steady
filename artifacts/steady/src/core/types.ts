export type TaskType = "tapping" | "face";
export type MedState = "on" | "off" | "just_took" | "unsure";

export type MetricKey =
  | "tap_freq_hz"
  | "tap_amp_norm"
  | "tap_amp_decrement_pct"
  | "tap_rhythm_cv"
  | "tap_hesitations"
  | "blink_rate_bpm"
  | "smile_amp"
  | "smile_onset_ms"
  | "face_expressivity";

export interface MetricDef {
  key: MetricKey;
  task: TaskType;
  unit: string;
  higherIsBetter: boolean;
  weight: number;
  minScale: number;
  decimals: number;
  label: string;
}

export type QualityIssue =
  | "no_hand"
  | "no_face"
  | "too_dark"
  | "too_bright"
  | "too_close"
  | "too_far"
  | "out_of_frame"
  | "low_tracking";

export interface Session {
  id: string;
  task: TaskType;
  startedAt: number;
  durationSec: number;
  hand?: "left" | "right";
  medState: MedState;
  metrics: Partial<Record<MetricKey, number>>;
  quality: {
    score: number;
    validFrameRatio: number;
    issues: QualityIssue[];
  };
  valid: boolean;
  isDemo?: boolean;
  note?: string;
}

export interface Profile {
  id: "me";
  name?: string;
  language: "en" | "hi" | "te";
  ageRange?: "<40" | "40-49" | "50-59" | "60-69" | "70+";
  diagnosisStatus: "diagnosed" | "suspected" | "none";
  dominantHand?: "left" | "right";
  medTimes?: string[];
  consent: { camera: boolean; localStorage: boolean; acceptedAt: number };
  fontScale: 1 | 1.25 | 1.5;
  highContrast: boolean;
  voiceGuidance: boolean;
  caregiverAssist?: boolean;
}