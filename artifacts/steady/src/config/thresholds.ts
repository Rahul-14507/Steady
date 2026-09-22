export const T = {
  brightness: { min: 60, max: 210 },
  hand: { minSize: 0.1, maxSize: 0.4 },
  face: { minHeight: 0.25, maxHeight: 0.85 },
  tapping: {
    durationSec: 15,
    minValidFrameRatio: 0.7,
    minTaps: 6,
    okHoldMs: 1000,
    autoStartMs: 3000,
    caregiverAutoStartMs: 10000,
  },
  faceTask: {
    spontaneousSec: 30,
    smileReps: 3,
    smileWindowSec: 4,
    minValidFrameRatio: 0.7,
  },
  baseline: { minSessions: 3, targetSessions: 5 },
  trend: { improveAbove: 58, declineBelow: 42 },
} as const;