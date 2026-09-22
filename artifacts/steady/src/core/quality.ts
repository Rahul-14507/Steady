import { T } from "../config/thresholds";
import type { LM } from "./tapping";
import type { QualityIssue } from "./types";

export function assessHandFrame(landmarks: LM[] | undefined, brightness: number, handSize: number): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (!landmarks) return ["no_hand"];
  if (landmarks.some((point) => point.x < 0.02 || point.x > 0.98 || point.y < 0.02 || point.y > 0.98)) issues.push("out_of_frame");
  if (handSize < T.hand.minSize) issues.push("too_far");
  if (handSize > T.hand.maxSize) issues.push("too_close");
  if (brightness < T.brightness.min) issues.push("too_dark");
  if (brightness > T.brightness.max) issues.push("too_bright");
  return issues;
}

export function assessFaceFrame(landmarks: LM[] | undefined, brightness: number): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (!landmarks) return ["no_face"];
  const xs = landmarks.map((point) => point.x);
  const ys = landmarks.map((point) => point.y);
  const faceHeight = Math.max(...ys) - Math.min(...ys);
  if (faceHeight < T.face.minHeight) issues.push("too_far");
  if (faceHeight > T.face.maxHeight) issues.push("too_close");
  if (Math.min(...xs) < 0.02 || Math.max(...xs) > 0.98) issues.push("out_of_frame");
  if (brightness < T.brightness.min) issues.push("too_dark");
  if (brightness > T.brightness.max) issues.push("too_bright");
  return issues;
}

export function qualityScore(validFrameRatio: number, issues: QualityIssue[]) {
  return Math.round(Math.max(0, Math.min(1, validFrameRatio)) * 100 * Math.max(0.4, 1 - issues.length * 0.12));
}