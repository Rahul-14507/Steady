import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const modelsDir = path.join(projectRoot, 'public', 'models');
const wasmDir = path.join(projectRoot, 'public', 'wasm');

fs.mkdirSync(modelsDir, { recursive: true });
fs.mkdirSync(wasmDir, { recursive: true });

async function downloadFile(url, destPath) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
    console.log(`[assets] Already exists: ${path.basename(destPath)}`);
    return;
  }
  console.log(`[assets] Downloading ${path.basename(destPath)}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
  console.log(`[assets] Saved ${path.basename(destPath)} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
}

async function copyOrDownloadWasm() {
  const nodeWasmDir = path.join(projectRoot, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
  if (fs.existsSync(nodeWasmDir)) {
    const files = fs.readdirSync(nodeWasmDir);
    for (const file of files) {
      const src = path.join(nodeWasmDir, file);
      const dest = path.join(wasmDir, file);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dest);
      }
    }
    console.log(`[assets] Copied wasm runtimes from @mediapipe/tasks-vision.`);
  } else {
    console.log(`[assets] node_modules/@mediapipe/tasks-vision not found yet. Run pnpm install first.`);
  }
}

async function main() {
  try {
    await downloadFile(
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      path.join(modelsDir, 'hand_landmarker.task')
    );
    await downloadFile(
      'https://storage.googleapis.com/mediapipe-models/face_landmarker/float16/1/face_landmarker.task',
      path.join(modelsDir, 'face_landmarker.task')
    );
    await copyOrDownloadWasm();
    console.log('[assets] Vision models and wasm runtimes ready!');
  } catch (err) {
    console.error('[assets] Error downloading assets:', err);
    process.exit(1);
  }
}

main();
