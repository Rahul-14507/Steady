export interface Point {
  x: number;
  y: number;
  z?: number;
}

const HAND_CONNECTIONS: [number, number][] = [
  // Wrist to fingers base
  [0, 1], [0, 5], [5, 9], [9, 13], [13, 17], [0, 17],
  // Thumb
  [1, 2], [2, 3], [3, 4],
  // Index
  [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [17, 18], [18, 19], [19, 20],
];

const FACE_CONTOUR = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
  379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
  234, 127, 162, 21, 54, 103, 67, 109, 10
];

const LIPS_OUTER = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 185, 61
];

const LIPS_INNER = [
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308
];

const LEFT_EYE = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33
];

const RIGHT_EYE = [
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 362
];

const LEFT_EYEBROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const RIGHT_EYEBROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];
const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2];

export function clearCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function generateAnimatedHandLandmarks(): Point[] {
  const now = performance.now();
  const tapCycle = (Math.sin(now * 0.008) + 1) / 2; // 0 to 1 rhythm
  const indexTipY = 0.28 + tapCycle * 0.12;

  return [
    { x: 0.50, y: 0.80 }, // 0: Wrist
    { x: 0.44, y: 0.70 }, // 1: Thumb CMC
    { x: 0.38, y: 0.60 }, // 2: Thumb MCP
    { x: 0.34, y: 0.50 }, // 3: Thumb IP
    { x: 0.36, y: 0.40 }, // 4: Thumb Tip
    { x: 0.46, y: 0.55 }, // 5: Index MCP
    { x: 0.45, y: 0.45 }, // 6: Index PIP
    { x: 0.44, y: 0.36 }, // 7: Index DIP
    { x: 0.38, y: indexTipY }, // 8: Index Tip (taps toward thumb tip)
    { x: 0.52, y: 0.53 }, // 9: Middle MCP
    { x: 0.52, y: 0.41 }, // 10: Middle PIP
    { x: 0.52, y: 0.32 }, // 11: Middle DIP
    { x: 0.52, y: 0.22 }, // 12: Middle Tip
    { x: 0.58, y: 0.55 }, // 13: Ring MCP
    { x: 0.58, y: 0.44 }, // 14: Ring PIP
    { x: 0.58, y: 0.35 }, // 15: Ring DIP
    { x: 0.58, y: 0.26 }, // 16: Ring Tip
    { x: 0.64, y: 0.60 }, // 17: Pinky MCP
    { x: 0.64, y: 0.52 }, // 18: Pinky PIP
    { x: 0.64, y: 0.45 }, // 19: Pinky DIP
    { x: 0.64, y: 0.38 }, // 20: Pinky Tip
  ];
}

function generateAnimatedFaceLandmarks(): Point[] {
  const now = performance.now();
  const smileCycle = (Math.sin(now * 0.003) + 1) / 2; // 0 to 1 smile swell
  const lipCornerY = 0.58 - smileCycle * 0.04;

  const points: Point[] = new Array(478).fill(0).map(() => ({ x: 0.5, y: 0.5 }));
  
  // Contour outline
  const ovalX = [0.5, 0.58, 0.65, 0.68, 0.66, 0.62, 0.56, 0.50, 0.44, 0.38, 0.34, 0.32, 0.35, 0.42, 0.5];
  const ovalY = [0.18, 0.22, 0.30, 0.42, 0.55, 0.66, 0.74, 0.76, 0.74, 0.66, 0.55, 0.42, 0.30, 0.22, 0.18];
  FACE_CONTOUR.forEach((idx, i) => {
    points[idx] = { x: ovalX[i % ovalX.length], y: ovalY[i % ovalY.length] };
  });

  // Eyes
  LEFT_EYE.forEach((idx) => { points[idx] = { x: 0.40, y: 0.38 }; });
  RIGHT_EYE.forEach((idx) => { points[idx] = { x: 0.60, y: 0.38 }; });

  // Eyebrows
  LEFT_EYEBROW.forEach((idx, i) => { points[idx] = { x: 0.35 + i * 0.02, y: 0.30 }; });
  RIGHT_EYEBROW.forEach((idx, i) => { points[idx] = { x: 0.55 + i * 0.02, y: 0.30 }; });

  // Nose
  NOSE_BRIDGE.forEach((idx, i) => { points[idx] = { x: 0.50, y: 0.32 + i * 0.03 }; });

  // Lips
  LIPS_OUTER.forEach((idx, i) => {
    const isCorner = i === 0 || i === 10;
    points[idx] = { x: 0.42 + (i % 11) * 0.016, y: isCorner ? lipCornerY : 0.60 };
  });
  LIPS_INNER.forEach((idx, i) => {
    points[idx] = { x: 0.44 + (i % 9) * 0.015, y: 0.60 };
  });

  // Key anchors
  points[1] = { x: 0.50, y: 0.48 }; // Nose tip
  points[33] = { x: 0.38, y: 0.38 };
  points[133] = { x: 0.44, y: 0.38 };
  points[362] = { x: 0.56, y: 0.38 };
  points[263] = { x: 0.62, y: 0.38 };
  points[61] = { x: 0.42, y: lipCornerY };
  points[291] = { x: 0.58, y: lipCornerY };
  points[13] = { x: 0.50, y: 0.58 };
  points[14] = { x: 0.50, y: 0.62 };

  return points;
}

export function drawHandSkeleton(
  canvas: HTMLCanvasElement,
  landmarks: Point[] | undefined
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const activeLandmarks = (landmarks && landmarks.length > 0)
    ? landmarks
    : generateAnimatedHandLandmarks();

  const width = canvas.width;
  const height = canvas.height;

  const points = activeLandmarks.map((p) => ({
    x: p.x * width,
    y: p.y * height,
  }));

  ctx.save();

  // Draw HUD Header Badge
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.roundRect ? ctx.roundRect(12, 12, 180, 32, 10) : ctx.fillRect(12, 12, 180, 32);
  ctx.fill();
  ctx.fillStyle = "#00f2fe";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("● HAND SKELETON (21 LMs)", 22, 32);

  // Draw bone connections
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0, 242, 254, 0.95)"; // Vibrant cyan line
  ctx.shadowColor = "#00f2fe";
  ctx.shadowBlur = 12;

  for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
    const p1 = points[startIdx];
    const p2 = points[endIdx];
    if (p1 && p2) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  // Draw index tip to thumb tip active distance line
  const thumbTip = points[4];
  const indexTip = points[8];
  if (thumbTip && indexTip) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(246, 211, 101, 1.0)"; // Gold active tap indicator
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(thumbTip.x, thumbTip.y);
    ctx.lineTo(indexTip.x, indexTip.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw active tap pulse circle at index tip
    ctx.fillStyle = "rgba(246, 211, 101, 0.5)";
    ctx.beginPath();
    ctx.arc(indexTip.x, indexTip.y, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw joint nodes
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
    const radius = isTip ? 7 : 4.5;

    ctx.fillStyle = isTip ? "#f6d365" : "#00f2fe";
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

export function drawFaceMesh(
  canvas: HTMLCanvasElement,
  landmarks: Point[] | undefined
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const activeLandmarks = (landmarks && landmarks.length > 0)
    ? landmarks
    : generateAnimatedFaceLandmarks();

  const width = canvas.width;
  const height = canvas.height;

  const points = activeLandmarks.map((p) => ({
    x: p.x * width,
    y: p.y * height,
  }));

  ctx.save();

  // Draw HUD Header Badge
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.roundRect ? ctx.roundRect(12, 12, 190, 32, 10) : ctx.fillRect(12, 12, 190, 32);
  ctx.fill();
  ctx.fillStyle = "#00f5d4";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("● FACE MESH GRAPH (478 LMs)", 22, 32);

  ctx.shadowColor = "#00f5d4";
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(0, 245, 212, 0.9)";

  const drawPath = (indices: number[], close = false) => {
    ctx.beginPath();
    let first = true;
    for (const idx of indices) {
      const p = points[idx];
      if (!p) continue;
      if (first) {
        ctx.moveTo(p.x, p.y);
        first = false;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    if (close) ctx.closePath();
    ctx.stroke();
  };

  // Draw main facial features
  drawPath(FACE_CONTOUR, true);
  drawPath(LIPS_OUTER, true);
  drawPath(LIPS_INNER, true);
  drawPath(LEFT_EYE, true);
  drawPath(RIGHT_EYE, true);
  drawPath(LEFT_EYEBROW, false);
  drawPath(RIGHT_EYEBROW, false);
  drawPath(NOSE_BRIDGE, false);

  // Draw key facial anchor nodes (nose tip, eye centers, mouth corners)
  const keyIndices = [1, 33, 133, 362, 263, 61, 291, 13, 14];
  for (const idx of keyIndices) {
    const p = points[idx];
    if (p) {
      ctx.fillStyle = "#f6d365";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  ctx.restore();
}
