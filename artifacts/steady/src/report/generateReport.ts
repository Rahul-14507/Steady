import { jsPDF } from "jspdf";
import { METRICS } from "../core/metricsRegistry";
import { computeBaseline } from "../core/baseline";
import { explainChange } from "../core/explain";
import type { Profile, Session, MetricKey } from "../core/types";

const DISCLAIMER = "Steady does not diagnose any condition. It is not a substitute for medical advice.";

function sparkline(doc: jsPDF, values: number[], x: number, y: number, width: number, height: number) {
  if (values.length < 2) return;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  doc.setDrawColor(39, 104, 96).setLineWidth(0.5);
  for (let index = 1; index < values.length; index += 1) {
    const x1 = x + ((index - 1) / (values.length - 1)) * width;
    const x2 = x + (index / (values.length - 1)) * width;
    const y1 = y + height - ((values[index - 1] - min) / span) * height;
    const y2 = y + height - ((values[index] - min) / span) * height;
    doc.line(x1, y1, x2, y2);
  }
}

function valueFor(session: Session, key: MetricKey) {
  return session.metrics[key];
}

export function buildReport(profile: Profile | undefined, sessions: Session[], rangeDays = 90) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const now = Date.now();
  const since = now - rangeDays * 86_400_000;
  const validInRange = sessions.filter((session) => session.valid !== false && session.startedAt >= since);
  const included = validInRange.length > 0 ? validInRange : sessions;
  const reportProfile = profile ?? {
    id: "me" as const,
    name: "Personal Check-in",
    language: "en" as const,
    consent: { camera: true, localStorage: true, acceptedAt: now },
    fontScale: 1 as const,
    highContrast: false,
    voiceGuidance: false,
    diagnosisStatus: "none" as const,
  };

  doc.setFillColor(232, 243, 238);
  doc.rect(0, 0, 210, 44, "F");
  doc.setTextColor(26, 60, 56);
  doc.setFont("helvetica", "bold").setFontSize(24);
  doc.text("Steady movement report", 18, 22);
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text(`Patient: ${reportProfile.name || "Personal Check-in"} · Prepared ${new Date(now).toLocaleDateString()}`, 18, 32);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(65, 78, 75);
  doc.text(`Reporting window: Last ${rangeDays} days`, 18, 39);

  let y = 56;
  doc.setTextColor(26, 60, 56).setFont("helvetica", "bold").setFontSize(13);
  doc.text("About this report", 18, y);
  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(65, 78, 75);
  doc.text(`Patient name: ${reportProfile.name || "Personal Check-in"}`, 18, y);
  doc.text(`Usual hand: ${String(reportProfile.dominantHand ?? "Not provided")}`, 110, y);
  y += 6;
  doc.text(`Recorded sessions: ${included.length}`, 18, y);
  doc.text(`Average capture quality: ${included.length ? Math.round(included.reduce((sum, session) => sum + (session.quality?.score ?? 80), 0) / included.length) : 0}%`, 110, y);
  y += 15;

  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(26, 60, 56);
  doc.text("Metric summary", 18, y);
  y += 8;
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(65, 78, 75);
  doc.text("Metric", 18, y);
  doc.text("Usual", 72, y);
  doc.text("Recent", 105, y);
  doc.text("Change", 138, y);
  doc.text("Sessions", 172, y);
  y += 4;
  doc.setDrawColor(187, 205, 198).line(18, y, 192, y);
  y += 6;

  const keys = Object.keys(METRICS) as MetricKey[];
  for (const key of keys) {
    const values = included.map((session) => valueFor(session, key)).filter((value): value is number => value !== undefined);
    if (!values.length) continue;
    const baseline = computeBaseline(key, values);
    const recent = values.slice(-3);
    const recentValue = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    const change = baseline ? explainChange(key, recentValue, baseline).pctChange : 0;
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(65, 78, 75);
    doc.text(METRICS[key].label, 18, y);
    doc.text(baseline ? `${baseline.median.toFixed(METRICS[key].decimals)} ${METRICS[key].unit}` : "Learning", 72, y);
    doc.text(`${recentValue.toFixed(METRICS[key].decimals)} ${METRICS[key].unit}`, 105, y);
    doc.text(baseline ? `${change > 0 ? "+" : ""}${change}%` : "—", 138, y);
    doc.text(String(values.length), 172, y);
    sparkline(doc, values, 18, y + 3, 38, 8);
    y += 17;
    if (y > 265) break;
  }

  doc.setFillColor(246, 249, 247);
  doc.roundedRect(18, 274, 174, 14, 3, 3, "F");
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(65, 78, 75);
  doc.text(DISCLAIMER, 23, 282);

  doc.addPage();
  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(26, 60, 56);
  doc.text("Methods and limitations", 18, 24);
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(65, 78, 75);
  const notes = [
    "Steady uses the phone camera to estimate movement patterns and facial movement on this device.",
    "It does not store or send video, images, or face and hand landmarks.",
    "Measures can change with lighting, camera position, glasses, facial hair, and model behavior.",
    "These measures are not equivalent to a clinical scale and have not been clinically validated.",
    "Thresholds are starting values and are not a medical device or a substitute for medical advice.",
  ];
  notes.forEach((note, index) => doc.text(`• ${note}`, 20, 42 + index * 12, { maxWidth: 168 }));
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(26, 60, 56);
  doc.text(DISCLAIMER, 20, 120, { maxWidth: 165 });
  return doc;
}

export interface ReportSummaryRow {
  key: MetricKey;
  label: string;
  unit: string;
  usualStr: string;
  recentStr: string;
  changeStr: string;
  sessionCount: number;
  values: number[];
}

export interface ReportData {
  patientName: string;
  preparedDate: string;
  rangeDays: number;
  sessionCount: number;
  dominantHand: string;
  avgQuality: number;
  rows: ReportSummaryRow[];
}

export function getReportData(profile: Profile | undefined, sessions: Session[], rangeDays = 90): ReportData {
  const now = Date.now();
  const since = now - rangeDays * 86_400_000;
  const validInRange = sessions.filter((session) => session.valid !== false && session.startedAt >= since);
  const included = validInRange.length > 0 ? validInRange : sessions;
  const reportProfile = profile ?? {
    id: "me" as const,
    name: "Personal Check-in",
    language: "en" as const,
    consent: { camera: true, localStorage: true, acceptedAt: now },
    fontScale: 1 as const,
    highContrast: false,
    voiceGuidance: false,
    diagnosisStatus: "none" as const,
  };

  const keys = Object.keys(METRICS) as MetricKey[];
  const rows: ReportSummaryRow[] = [];

  for (const key of keys) {
    const values = included.map((session) => valueFor(session, key)).filter((value): value is number => value !== undefined);
    if (!values.length) continue;
    const baseline = computeBaseline(key, values);
    const recent = values.slice(-3);
    const recentValue = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    const change = baseline ? explainChange(key, recentValue, baseline).pctChange : 0;

    rows.push({
      key,
      label: METRICS[key].label,
      unit: METRICS[key].unit,
      usualStr: baseline ? `${baseline.median.toFixed(METRICS[key].decimals)} ${METRICS[key].unit}` : "Learning",
      recentStr: `${recentValue.toFixed(METRICS[key].decimals)} ${METRICS[key].unit}`,
      changeStr: baseline ? `${change > 0 ? "+" : ""}${change}%` : "—",
      sessionCount: values.length,
      values,
    });
  }

  const avgQuality = included.length
    ? Math.round(included.reduce((sum, session) => sum + (session.quality?.score ?? 80), 0) / included.length)
    : 0;

  return {
    patientName: reportProfile.name || "Personal Check-in",
    preparedDate: new Date(now).toLocaleDateString(),
    rangeDays,
    sessionCount: included.length,
    dominantHand: String(reportProfile.dominantHand ?? "Right hand"),
    avgQuality,
    rows,
  };
}

export async function shareOrDownload(doc: jsPDF, name = "steady-report.pdf") {
  const blob = doc.output("blob");
  const file = new File([blob], name, { type: "application/pdf" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Steady Clinical Movement Report" });
      return;
    } catch { /* user cancelled share */ }
  }
  doc.save(name);
}

export function getReportBlobUrl(doc: jsPDF): string {
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}